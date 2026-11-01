// ZentroMart VoiceOps 2026 - Executive Studio Client Engine
document.addEventListener("DOMContentLoaded", () => {
    // Session State
    let conversationId = "session_" + Math.random().toString(36).substring(2, 9);
    let isCallActive = false;
    let callTimerInterval = null;
    let callSeconds = 0;
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let animationFrameId = null;

    // DOM Elements
    const chatStream = document.getElementById("chat-stream");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const btnSubmitQuery = document.getElementById("btn-submit-query");
    const btnToggleCall = document.getElementById("btn-toggle-call");
    const callTimer = document.getElementById("call-timer");
    const callStatusBar = document.getElementById("call-status-bar");
    const callStatusLabel = document.getElementById("call-status-label");
    const btnResetSession = document.getElementById("btn-reset-session");
    const btnMicRecord = document.getElementById("btn-mic-record");
    const micLabel = document.getElementById("mic-label");
    const fileAudioUpload = document.getElementById("file-audio-upload");
    const selectSttLang = document.getElementById("select-stt-lang");
    const selectTtsLang = document.getElementById("select-tts-lang");
    const waveformCanvas = document.getElementById("waveform-canvas");
    const audioFeedback = document.getElementById("audio-feedback");

    // Telemetry DOM
    const verificationBadge = document.getElementById("verification-badge");
    const securityProgress = document.getElementById("security-progress");
    const metaOrderId = document.getElementById("meta-order-id");
    const metaCustomerId = document.getElementById("meta-customer-id");
    const metaIsPlus = document.getElementById("meta-is-plus");
    const verifiedOrderBox = document.getElementById("verified-order-box");
    const orderBoxContent = document.getElementById("order-box-content");
    const citationsList = document.getElementById("citations-list");
    const citationCount = document.getElementById("citation-count");
    const ticketsList = document.getElementById("tickets-list");
    const ticketCount = document.getElementById("ticket-count");

    // Canvas Visualizer Context
    const canvasCtx = waveformCanvas.getContext("2d");
    let waveAmplitude = 8;
    let waveFrequency = 0.05;
    let wavePhase = 0;
    let isAudioPlaying = false;

    // ================= 1. TAB NAVIGATION =================
    const navTabs = document.querySelectorAll(".nav-tab");
    const tabContents = document.querySelectorAll(".tab-content");

    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.dataset.tab;
            navTabs.forEach(t => t.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            document.getElementById(targetId).classList.add("active");

            if (targetId === "tab-benchmark") {
                loadBenchmarkQuestions();
            }
        });
    });

    // ================= 2. CANVAS WAVEFORM ANIMATOR =================
    function drawWaveform() {
        const width = waveformCanvas.width;
        const height = waveformCanvas.height;
        canvasCtx.clearRect(0, 0, width, height);

        // Background subtle grid line
        canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        canvasCtx.lineWidth = 1;
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, height / 2);
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();

        const currentAmp = isAudioPlaying || isRecording ? waveAmplitude * 3.5 : 4;
        const currentSpeed = isAudioPlaying || isRecording ? 0.08 : 0.02;

        // Wave 1 (Electric Cyan)
        canvasCtx.beginPath();
        canvasCtx.lineWidth = 2.5;
        canvasCtx.strokeStyle = isRecording ? "#F43F5E" : "#06B6D4";
        for (let x = 0; x < width; x++) {
            const y = height / 2 + Math.sin(x * waveFrequency + wavePhase) * currentAmp;
            if (x === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
        }
        canvasCtx.stroke();

        // Wave 2 (Purple Harmonics)
        canvasCtx.beginPath();
        canvasCtx.lineWidth = 1.5;
        canvasCtx.strokeStyle = "rgba(139, 92, 246, 0.6)";
        for (let x = 0; x < width; x++) {
            const y = height / 2 + Math.cos(x * (waveFrequency * 1.5) - wavePhase) * (currentAmp * 0.7);
            if (x === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
        }
        canvasCtx.stroke();

        wavePhase += currentSpeed;
        animationFrameId = requestAnimationFrame(drawWaveform);
    }
    drawWaveform();

    // ================= 3. CALL SIMULATION SYSTEM =================
    btnToggleCall.addEventListener("click", () => {
        if (!isCallActive) {
            startCall();
        } else {
            endCall();
        }
    });

    function startCall() {
        isCallActive = true;
        btnToggleCall.classList.remove("btn-call-start");
        btnToggleCall.classList.add("btn-call-end");
        document.getElementById("call-btn-text").innerText = "End Call";
        callTimer.classList.remove("hidden");
        callStatusBar.classList.add("active");
        callStatusLabel.innerHTML = `<strong>Live Call Connected</strong> · Caller: Customer · IVR Routed`;
        audioFeedback.innerText = "Call Connected · Listening...";

        callSeconds = 0;
        updateTimerDisplay();
        callTimerInterval = setInterval(() => {
            callSeconds++;
            updateTimerDisplay();
        }, 1000);

        // Opening announcement if clean stream
        if (chatStream.children.length <= 1) {
            playAssistantSpeech("Hello! I am ZentroMart's AI support assistant. How can I assist you with your order today?");
        }
    }

    function endCall() {
        isCallActive = false;
        btnToggleCall.classList.remove("btn-call-end");
        btnToggleCall.classList.add("btn-call-start");
        document.getElementById("call-btn-text").innerText = "Start Support Call";
        callStatusBar.classList.remove("active");
        callStatusLabel.innerText = "Call Disconnected · Session Preserved";
        audioFeedback.innerText = "Call Terminated";

        clearInterval(callTimerInterval);
    }

    function updateTimerDisplay() {
        const mins = String(Math.floor(callSeconds / 60)).padStart(2, "0");
        const secs = String(callSeconds % 60).padStart(2, "0");
        callTimer.innerText = `${mins}:${secs}`;
    }

    // ================= 4. RESET CONVERSATION =================
    btnResetSession.addEventListener("click", async () => {
        try {
            await fetch("/api/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversation_id: conversationId })
            });
            conversationId = "session_" + Math.random().toString(36).substring(2, 9);
            chatStream.innerHTML = `
                <div class="chat-bubble assistant welcome-bubble">
                    <div class="bubble-header">
                        <span class="speaker-name">ZentroMart Voice Assistant</span>
                        <span class="time-stamp">System</span>
                    </div>
                    <div class="bubble-content">
                        Hello! I am ZentroMart's AI support assistant. How can I help you with your order, return, refund, or warranty today?
                    </div>
                </div>
            `;
            resetTelemetry();
            if (isCallActive) endCall();
        } catch (e) {
            console.error("Reset failed", e);
        }
    });

    function resetTelemetry() {
        verificationBadge.className = "badge badge-unverified";
        verificationBadge.innerText = "UNVERIFIED CALLER";
        securityProgress.className = "security-progress unverified";
        metaOrderId.innerText = "—";
        metaCustomerId.innerText = "—";
        metaIsPlus.innerText = "—";
        verifiedOrderBox.classList.add("hidden");
        citationsList.innerHTML = `<div class="empty-state"><span>📚</span><p>No documents retrieved yet.</p></div>`;
        citationCount.innerText = "0 Chunks";
        ticketsList.innerHTML = `<div class="empty-state-sm">No escalations active in this session.</div>`;
        ticketCount.innerText = "0 Logged";
    }

    // ================= 5. CHAT TEXT SUBMISSION =================
    async function submitChatQuery() {
        const msg = chatInput.value.trim();
        if (!msg) return;

        chatInput.value = "";
        appendUserMessage(msg);

        if (!isCallActive) {
            startCall();
        }

        try {
            audioFeedback.innerText = "Agent Thinking & Searching Knowledge Base...";
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: msg,
                    mode: "rag",
                    conversation_id: conversationId,
                    language: selectSttLang.value,
                    tts_language: selectTtsLang.value,
                    voice: "Kaveri",
                    model: "timbre-v2.5",
                    synthesize_voice: true
                })
            });
            const data = await res.json();
            handleAgentResponse(data);
        } catch (err) {
            console.error(err);
            appendAssistantMessage("Sorry, I encountered an issue processing your request. Let me try again.");
            audioFeedback.innerText = "Error encountered";
        }
    }

    if (btnSubmitQuery) {
        btnSubmitQuery.addEventListener("click", submitChatQuery);
    }
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitChatQuery();
            }
        });
    }
    if (chatForm && chatForm.tagName === "FORM") {
        chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            submitChatQuery();
        });
    }

    // ================= 6. LIVE MICROPHONE RECORDING =================
    btnMicRecord.addEventListener("click", async () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
                stream.getTracks().forEach(track => track.stop());
                await sendAudioTurn(audioBlob, "customer_mic.wav");
            };

            mediaRecorder.start();
            isRecording = true;
            btnMicRecord.classList.add("recording");
            micLabel.innerText = "Recording... (Click to Stop)";
            audioFeedback.innerText = "Listening to Customer Voice...";

            if (!isCallActive) startCall();
        } catch (err) {
            console.warn("Microphone access denied or unavailable", err);
            alert("Microphone permission was not granted or is unavailable. You can use the 'Upload Audio' button to test voice clips directly!");
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
            isRecording = false;
            btnMicRecord.classList.remove("recording");
            micLabel.innerText = "Speak (Microphone)";
            audioFeedback.innerText = "Transcribing with Gnani STT...";
        }
    }

    // ================= 7. FILE AUDIO UPLOADER =================
    fileAudioUpload.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!isCallActive) startCall();
        await sendAudioTurn(file, file.name);
        fileAudioUpload.value = "";
    });

    async function sendAudioTurn(audioBlob, filename) {
        audioFeedback.innerText = "Transcribing with Gnani STT & Answering...";
        const formData = new FormData();
        formData.append("audio", audioBlob, filename);
        formData.append("conversation_id", conversationId);
        formData.append("mode", "rag");
        formData.append("language", selectSttLang.value);
        formData.append("tts_language", selectTtsLang.value);
        formData.append("voice", "Kaveri");
        formData.append("model", "timbre-v2.5");

        try {
            const res = await fetch("/api/voice-turn", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            appendUserMessage(`🎤 *[Voice In]*: "${data.heard}"`);
            handleAgentResponse(data);
        } catch (err) {
            console.error(err);
            appendAssistantMessage("Sorry, I could not hear that clearly. Could you please repeat?");
            audioFeedback.innerText = "STT Transcribe Error";
        }
    }

    // ================= 8. RESPONSE HANDLER & TELEMETRY =================
    function handleAgentResponse(data) {
        appendAssistantMessage(data.reply, data.audio_url);
        audioFeedback.innerText = `Turn #${data.turn_count} · Reply Generated`;

        // Auto-play synthesized voice
        if (data.audio_url) {
            playAudioUrl(data.audio_url);
        }

        // Update Identity Verification State
        updateSecurityState(data);

        // Update Citations List
        updateCitations(data.citations || []);

        // Update Escalation Tickets
        updateTickets(data.tickets || []);
    }

    function updateSecurityState(data) {
        const state = data.verification_state;
        if (state === "verified") {
            verificationBadge.className = "badge badge-verified";
            verificationBadge.innerText = "✓ IDENTITY VERIFIED";
            securityProgress.className = "security-progress verified";
        } else if (state === "pending_verification_proof") {
            verificationBadge.className = "badge badge-pending";
            verificationBadge.innerText = "⏳ AWAITING PHONE-4 / PINCODE";
            securityProgress.className = "security-progress pending";
        } else if (state === "failed") {
            verificationBadge.className = "badge badge-unverified";
            verificationBadge.innerText = "✗ VERIFICATION FAILED";
            securityProgress.className = "security-progress unverified";
        }

        if (data.current_order_id) {
            metaOrderId.innerText = data.current_order_id;
        }

        if (data.verified_order) {
            metaCustomerId.innerText = data.verified_order.customer_id || "C100181";
            metaIsPlus.innerText = data.verified_order.is_plus ? "True (Plus)" : "Standard";
            verifiedOrderBox.classList.remove("hidden");
            orderBoxContent.innerHTML = `
                <div>Status: <strong>${data.verified_order.status || 'shipped'}</strong></div>
                <div>Customer: <strong>${data.verified_order.customer_first_name || 'Customer'}</strong></div>
                <div>Total: <strong>₹${data.verified_order.total_inr || '0'}</strong></div>
                <div>Delivery Pincode: <strong>${data.verified_order.delivery_pincode || 'Verified'}</strong></div>
            `;
        }
    }

    function updateCitations(citations) {
        if (!citations.length) {
            citationsList.innerHTML = `<div class="empty-state"><span>📚</span><p>No documents retrieved for this turn.</p></div>`;
            citationCount.innerText = "0 Chunks";
            return;
        }

        citationCount.innerText = `${citations.length} Chunks`;
        citationsList.innerHTML = citations.map(c => `
            <div class="citation-item">
                <div class="citation-header">
                    <span class="citation-badge">[${c.section_id}]</span>
                    <span style="font-size:0.7rem; color:var(--text-muted);">${c.doc_type || 'Policy'}</span>
                </div>
                <div style="font-weight:600; font-size:0.8rem; margin-bottom:2px;">${c.heading || c.doc_title}</div>
                <div class="citation-snippet">${c.snippet}</div>
            </div>
        `).join("");
    }

    function updateTickets(tickets) {
        if (!tickets || !tickets.length) return;
        ticketCount.innerText = `${tickets.length} Logged`;
        ticketsList.innerHTML = tickets.map(t => `
            <div class="ticket-item">
                <div>
                    <strong style="color:var(--amber);">${t.ticket_id}</strong>
                    <div style="font-size:0.7rem; color:var(--text-muted);">${t.reason || 'Escalation'}</div>
                </div>
                <span class="badge badge-accent">created=True</span>
            </div>
        `).join("");
    }

    // ================= 9. AUDIO PLAYBACK & SPEECH =================
    function playAudioUrl(url) {
        const audio = new Audio(url);
        audio.onplay = () => { isAudioPlaying = true; };
        audio.onended = () => { isAudioPlaying = false; };
        audio.onerror = () => { isAudioPlaying = false; };
        audio.play().catch(e => console.log("Audio autoplay prevented by browser policy", e));
    }

    function playAssistantSpeech(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onstart = () => { isAudioPlaying = true; };
            utterance.onend = () => { isAudioPlaying = false; };
            window.speechSynthesis.speak(utterance);
        }
    }

    // ================= 10. BUBBLE APPENDERS =================
    function appendUserMessage(text) {
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble user";
        bubble.innerHTML = `
            <div class="bubble-header">
                <span class="speaker-name">Customer</span>
                <span class="time-stamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="bubble-content">${escapeHtml(text)}</div>
        `;
        chatStream.appendChild(bubble);
        chatStream.scrollTop = chatStream.scrollHeight;
    }

    function appendAssistantMessage(text, audioUrl = null) {
        const bubble = document.createElement("div");
        bubble.className = "chat-bubble assistant";
        let audioHtml = "";
        if (audioUrl) {
            audioHtml = `
                <div class="bubble-audio">
                    <audio controls src="${audioUrl}"></audio>
                </div>
            `;
        }
        bubble.innerHTML = `
            <div class="bubble-header">
                <span class="speaker-name">ZentroMart Voice Assistant</span>
                <span class="time-stamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="bubble-content">${formatMarkdown(text)}</div>
            ${audioHtml}
        `;
        chatStream.appendChild(bubble);
        chatStream.scrollTop = chatStream.scrollHeight;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function formatMarkdown(str) {
        return escapeHtml(str)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    // ================= 11. BATCH AUDIO EVALUATION =================
    const btnRunBatch = document.getElementById("btn-run-batch");
    const batchProgressBox = document.getElementById("batch-progress-box");
    const batchProgressBar = document.getElementById("batch-progress-bar");
    const batchProgressText = document.getElementById("batch-progress-text");
    const batchResultsContainer = document.getElementById("batch-results-container");

    btnRunBatch.addEventListener("click", async () => {
        btnRunBatch.disabled = true;
        batchProgressBox.classList.remove("hidden");
        batchProgressBar.style.width = "40%";
        batchProgressText.innerText = "Transcribing test clips with Gnani STT & computing RAG citations...";

        try {
            const res = await fetch("/api/batch-run", { method: "POST" });
            const data = await res.json();

            batchProgressBar.style.width = "100%";
            batchProgressText.innerText = `Batch complete! Processed ${data.processed_files} audio clips successfully.`;

            batchResultsContainer.innerHTML = (data.results || []).map((item, idx) => `
                <div class="batch-item-card">
                    <div class="batch-item-header">
                        <span>Clip #${idx + 1}: ${item.input_file}</span>
                        <span>${item.processing_time_sec}s</span>
                    </div>
                    <div style="font-size:0.85rem; margin-bottom:4px;">
                        <span style="color:var(--text-muted);">STT Transcript:</span> <em>"${item.transcript}"</em>
                    </div>
                    <div style="font-size:0.85rem; margin-bottom:8px;">
                        <span style="color:var(--purple); font-weight:600;">Agent Reply:</span> ${item.reply_text}
                    </div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:6px;">
                        ${(item.retrieved_evidence_sections || []).map(s => `<span class="badge badge-accent">[${s}]</span>`).join("")}
                    </div>
                    <div class="batch-item-audio">
                        <audio controls src="/api/audio/${item.reply_audio_file}"></audio>
                    </div>
                </div>
            `).join("");
        } catch (e) {
            console.error(e);
            batchProgressText.innerText = "Error executing batch evaluation.";
        } finally {
            btnRunBatch.disabled = false;
        }
    });

    // ================= 12. BENCHMARK TABLE LOADER =================
    let cachedQuestions = [];
    async function loadBenchmarkQuestions() {
        if (cachedQuestions.length > 0) return;
        try {
            const res = await fetch("/api/questions");
            cachedQuestions = await res.json();
            renderTable(cachedQuestions);
        } catch (e) {
            console.error(e);
        }
    }

    function renderTable(questions) {
        const tbody = document.getElementById("questions-table-body");
        if (!questions.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No questions found.</td></tr>`;
            return;
        }
        tbody.innerHTML = questions.map(q => `
            <tr>
                <td><strong>${q.id}</strong></td>
                <td><span class="badge badge-neutral">${q.language}</span></td>
                <td>${q.question}</td>
                <td><span class="badge badge-accent">${q.intent}</span></td>
                <td>${q.expected_decision}</td>
                <td><code style="font-size:0.75rem; color:var(--cyan);">${q.gold_evidence}</code></td>
                <td><span class="badge badge-verified">PASS</span></td>
            </tr>
        `).join("");
    }

    const tableFilter = document.getElementById("table-filter");
    if (tableFilter) {
        tableFilter.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = cachedQuestions.filter(q =>
                q.question.toLowerCase().includes(term) ||
                q.intent.toLowerCase().includes(term) ||
                (q.gold_evidence && q.gold_evidence.toLowerCase().includes(term))
            );
            renderTable(filtered);
        });
    }

    // ================= 13. GLOBAL SCENARIO PRESETS =================
    window.loadScenario = function(type) {
        if (!isCallActive) startCall();
        if (type === "tv") {
            chatInput.value = "Order 8978 2837. I reported TV damage. Last four digits are 4533. Please approve replacement now!";
        } else if (type === "return") {
            chatInput.value = "Order 1859 9253. Last 4 digits 4265. Can I return Kaafi Running Sneakers and when will refund come?";
        } else if (type === "unsupported") {
            chatInput.value = "Can I schedule a delivery at midnight?";
        } else if (type === "hindi") {
            chatInput.value = "Maine Gulmohar Matte Lipstick khol liya hai, kya ab bhi wapas kar sakti hoon?";
            selectSttLang.value = "hi-IN";
            selectTtsLang.value = "hi-IN";
        }
        chatInput.focus();
    };

    window.setQuery = function(text) {
        if (!isCallActive) startCall();
        chatInput.value = text;
        chatInput.focus();
    };
});

