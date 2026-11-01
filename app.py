"""Enterprise VoiceOps 2026 Executive Dashboard (Streamlit Edition).

Run with:
    streamlit run app.py
"""
import os
import json
import time
import streamlit as st
from pathlib import Path
from src.agent import ZentroMartAgent
from src.retriever import ZentroMartRetriever
from src.voice import (
    VoicePipeline,
    normalize_text_for_speech,
    GNANI_STT_LANGUAGES,
    GNANI_TTS_LANGUAGES
)
from src.config import REFERENCE_DATE_STR, OUTPUTS_DIR

st.set_page_config(
    page_title="ZentroMart VoiceOps 2026 | Enterprise Voice AI",
    page_icon="🎙️",
    layout="wide"
)

# Custom High-End Cyber-Enterprise Glassmorphic Styling
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif;
    }
    
    .stApp {
        background-color: #090D16;
        background-image: 
            radial-gradient(circle at 10% 10%, rgba(6, 182, 212, 0.07) 0%, transparent 40%),
            radial-gradient(circle at 90% 90%, rgba(139, 92, 246, 0.07) 0%, transparent 40%);
        color: #F8FAFC;
    }
    
    /* Executive Header */
    .hero-banner {
        background: linear-gradient(135deg, rgba(14, 22, 38, 0.9), rgba(15, 23, 42, 0.8));
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 1.5rem 2rem;
        margin-bottom: 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
    }
    
    .hero-title {
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0;
    }
    
    .hero-gradient {
        background: linear-gradient(135deg, #06B6D4, #8B5CF6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    .hero-sub {
        font-size: 0.9rem;
        color: #94A3B8;
        margin-top: 4px;
    }
    
    .status-badge-box {
        display: flex;
        gap: 0.75rem;
    }
    
    .pill {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 6px 14px;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-family: 'JetBrains Mono', monospace;
    }
    
    /* Telemetry Cards */
    .kpi-card {
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 1.25rem;
        text-align: center;
    }
    .kpi-val { font-size: 1.8rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
    .kpi-title { font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
    
    .verified-chip {
        background: rgba(16, 185, 129, 0.15);
        color: #10B981;
        border: 1px solid rgba(16, 185, 129, 0.3);
        padding: 4px 12px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.85rem;
    }
    
    .pending-chip {
        background: rgba(245, 158, 11, 0.15);
        color: #F59E0B;
        border: 1px solid rgba(245, 158, 11, 0.3);
        padding: 4px 12px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.85rem;
    }
    
    .unverified-chip {
        background: rgba(244, 63, 94, 0.15);
        color: #F43F5E;
        border: 1px solid rgba(244, 63, 94, 0.3);
        padding: 4px 12px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.85rem;
    }
</style>
""", unsafe_allow_html=True)

# Initialize Session State
if "agent" not in st.session_state:
    st.session_state.retriever = ZentroMartRetriever()
    st.session_state.agent = ZentroMartAgent(mode="rag", retriever=st.session_state.retriever)
    st.session_state.voice = VoicePipeline()
    st.session_state.messages = []
    st.session_state.retrieved_history = []

# Hero Banner
st.markdown(f"""
<div class="hero-banner">
    <div>
        <h1 class="hero-title">ZentroMart <span class="hero-gradient">VoiceOps 2026</span></h1>
        <p class="hero-sub">Production Customer Support AI Agent · CAC, IIT Guwahati × Gnani.ai</p>
    </div>
    <div class="status-badge-box">
        <div class="pill">📅 Ref Date: <strong>{REFERENCE_DATE_STR}</strong></div>
        <div class="pill" style="color: #10B981;">🎙️ Gnani Engine: Active</div>
    </div>
</div>
""", unsafe_allow_html=True)

# Sidebar Configuration & Tools
with st.sidebar:
    st.image("https://img.icons8.com/fluency/96/headset.png", width=64)
    st.subheader("⚙️ VoiceOps Engine")
    mode_selection = st.radio("Agent Engine Mode", ["Grounded RAG (Step 2/3)", "Baseline Prompt-Only (Step 1)"])
    st.session_state.agent.mode = "rag" if "RAG" in mode_selection else "baseline"
    
    st.markdown("---")
    st.subheader("🎙️ Gnani Speech Settings")
    voice_name = st.selectbox("Voice Talent", ["Kaveri", "Trupti", "Pranav", "Shlok"])
    voice_model = st.selectbox("Speech Model", ["timbre-v2.5", "timbre-v3.0"])
    stt_lang = st.selectbox("Customer Audio In (STT)", list(GNANI_STT_LANGUAGES.keys()), index=1, format_func=lambda x: GNANI_STT_LANGUAGES.get(x, x))
    tts_lang = st.selectbox("Agent Audio Reply (TTS)", list(GNANI_TTS_LANGUAGES.keys()), index=1, format_func=lambda x: GNANI_TTS_LANGUAGES.get(x, x))
    
    st.markdown("---")
    st.subheader("📦 Deliverables & Packaging")
    zip_path = Path("team_voiceops_2026_voiceops.zip")
    if zip_path.exists():
        st.download_button("📥 Download Submission ZIP", zip_path.read_bytes(), file_name="team_voiceops_2026_voiceops.zip", mime="application/zip", key="dl_zip_btn_sidebar")

    if st.button("🔄 Reset Call Session"):
        st.session_state.agent.reset_conversation()
        st.session_state.messages = []
        st.session_state.retrieved_history = []
        st.rerun()

# Quick Scenario Presets
col_s1, col_s2, col_s3, col_s4 = st.columns(4)
with col_s1:
    if st.button("📺 1. TV Damage Escalation"):
        st.session_state.preset_prompt = "Order 8978 2837. Last 4 digits are 4533. I reported TV damage. Approve replacement now!"
with col_s2:
    if st.button("👟 2. Sneaker Return & Refund"):
        st.session_state.preset_prompt = "Order 1859 9253. Last four digits 4265. Can I return Kaafi Running Sneakers and when will refund come?"
with col_s3:
    if st.button("❓ 3. Unsupported Midnight Slot"):
        st.session_state.preset_prompt = "Can I schedule a delivery at midnight?"
with col_s4:
    if st.button("🇮🇳 4. Hindi Lipstick Policy"):
        st.session_state.preset_prompt = "Maine Gulmohar Matte Lipstick khol liya hai, kya ab bhi wapas kar sakti hoon?"

# 2-Column Main Layout: Left = Conversation & Audio, Right = Identity Gate & Citations
col_chat, col_inspect = st.columns([1.35, 1.0])

with col_chat:
    st.subheader("💬 Active Call & Conversation")
    
    # Message History Stream (Conversation Box)
    st.markdown("##### 📜 Transcript Stream")
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if msg.get("audio_path") and Path(msg["audio_path"]).exists():
                st.audio(Path(msg["audio_path"]).read_bytes(), format="audio/wav")

    st.markdown("<hr style='border: none; border-top: 1px solid rgba(255, 255, 255, 0.1); margin: 0.75rem 0;'>", unsafe_allow_html=True)

    # ── DEDICATED QUERY INPUT BAR (AT BOTTOM OF CONVERSATION) ───────
    st.markdown("""
    <div style="background: linear-gradient(135deg, rgba(14, 22, 38, 0.95), rgba(15, 23, 42, 0.9)); 
                border: 2px solid #06B6D4; 
                border-radius: 12px; 
                padding: 0.85rem 1.15rem; 
                margin-top: 0.5rem;
                margin-bottom: 0.75rem; 
                box-shadow: 0 0 20px rgba(6, 182, 212, 0.25);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.2rem;">⌨️</span>
                <strong style="color: #FFFFFF; font-size: 0.95rem;">Type Customer Query / Inquiry</strong>
            </div>
            <span style="background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 10px; border-radius: 9999px; font-size: 0.72rem; font-weight: 600;">Conversation Input Bar</span>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    # Dedicated Text Input Field and Submit Button
    col_inp, col_btn = st.columns([3.8, 1.2])
    with col_inp:
        form_query = st.text_input(
            "Enter Customer Query:",
            placeholder="Type your query here... e.g. Order 8978 2837. Last 4 digits 4533. Damaged TV",
            key="prominent_query_input",
            label_visibility="collapsed"
        )
    with col_btn:
        submit_form = st.button("🚀 Submit Query", use_container_width=True, key="btn_submit_prominent_query")

    # Quick Suggestion Chips
    st.markdown("<p style='font-size: 0.75rem; color: #F59E0B; margin: 0.25rem 0; font-weight: 600;'>⚡ QUICK EXAMPLE PROMPTS (CLICK TO RUN):</p>", unsafe_allow_html=True)
    qc1, qc2, qc3, qc4 = st.columns(4)
    with qc1:
        if st.button("💳 Wallet Speed", key="btn_wallet_q"):
            st.session_state.preset_prompt = "How fast are refunds credited to the ZentroMart Wallet?"
            st.rerun()
    with qc2:
        if st.button("👟 Sneaker Return", key="btn_sneaker_q"):
            st.session_state.preset_prompt = "Can I return Kaafi Running Sneakers? Order 1859 9253, last 4 digits 4265."
            st.rerun()
    with qc3:
        if st.button("📺 TV Claim", key="btn_tv_q"):
            st.session_state.preset_prompt = "Order 8978 2837. Last 4 digits 4533. I reported TV damage. Approve replacement now!"
            st.rerun()
    with qc4:
        if st.button("🇮🇳 Hindi Lipstick", key="btn_hindi_q"):
            st.session_state.preset_prompt = "Maine Gulmohar Matte Lipstick khol liya hai, kya ab bhi wapas kar sakti hoon?"
            st.rerun()

    with st.expander("🎙️ Customer Voice File Input (.wav / .mp3)"):
        uploaded_audio = st.file_uploader("Upload audio file", type=["wav", "mp3", "ogg"], label_visibility="collapsed")
        if uploaded_audio and st.button("🎙️ Process Voice Clip"):
            temp_in = OUTPUTS_DIR / f"temp_{uploaded_audio.name}"
            temp_in.write_bytes(uploaded_audio.read())
            
            with st.spinner("Transcribing via Gnani STT & retrieving ground policy..."):
                temp_out = OUTPUTS_DIR / f"reply_{Path(uploaded_audio.name).stem}.wav"
                heard, reply, out_wav = st.session_state.voice.voice_turn(
                    str(temp_in),
                    st.session_state.agent.respond,
                    language_code=stt_lang,
                    tts_language=tts_lang,
                    voice=voice_name,
                    model=voice_model,
                    output_wav_path=str(temp_out)
                )
                st.session_state.messages.append({"role": "user", "content": f"🎤 *[Voice In ({stt_lang})]*: {heard}"})
                st.session_state.messages.append({"role": "assistant", "content": reply, "audio_path": out_wav})
                st.rerun()

    # Secondary Bottom Chat Input
    bottom_input = st.chat_input("Speak or type to ZentroMart support...")
    
    # Resolve input from any source
    user_input = None
    if submit_form and form_query:
        user_input = form_query
    elif "preset_prompt" in st.session_state and st.session_state.preset_prompt:
        user_input = st.session_state.preset_prompt
        st.session_state.preset_prompt = None
    elif bottom_input:
        user_input = bottom_input

    if user_input:
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.spinner("ZentroMart AI agent reasoning..."):
            reply = st.session_state.agent.respond(user_input)
            
            # Generate spoken audio reply
            out_wav_path = str(OUTPUTS_DIR / f"reply_turn_{len(st.session_state.messages)}_{int(time.time() * 1000)}.wav")
            st.session_state.voice.synthesize(
                reply,
                out_wav_path,
                voice=voice_name,
                model=voice_model,
                language=tts_lang
            )
            st.session_state.messages.append({"role": "assistant", "content": reply, "audio_path": out_wav_path})
            st.rerun()

with col_inspect:
    st.subheader("🔍 Identity Gating & RAG Inspector")
    
    # 1. Identity Gate Security Status
    tm = st.session_state.agent.tool_manager
    st.markdown("#### 🛡️ Caller Identity Verification Gate")
    if tm.state == "verified":
        st.markdown('<span class="verified-chip">✓ AUTHENTICATED CALLER (VERIFIED)</span>', unsafe_allow_html=True)
    elif tm.state == "pending_verification_proof":
        st.markdown('<span class="pending-chip">⏳ GATED: AWAITING PHONE LAST-4 OR PINCODE</span>', unsafe_allow_html=True)
    elif tm.state == "failed":
        st.markdown('<span class="unverified-chip">✗ VERIFICATION FAILED</span>', unsafe_allow_html=True)
    else:
        st.markdown('<span class="unverified-chip">UNAUTHENTICATED (ORDER DETAILS PROTECTED)</span>', unsafe_allow_html=True)

    if tm.verified_order:
        st.markdown("##### 📦 Decrypted Order Record")
        st.json({
            "order_id": tm.verified_order.get("order_id"),
            "customer": tm.verified_order.get("customer_first_name"),
            "status": tm.verified_order.get("status"),
            "total_inr": tm.verified_order.get("total_inr"),
            "is_plus": tm.verified_order.get("is_plus"),
            "items": len(tm.verified_order.get("items", []))
        })

    # 2. RAG Citations
    st.markdown("---")
    st.markdown("#### 📚 Retrieved Grounding Evidence")
    ev_ids = st.session_state.agent.last_retrieved_evidence
    if ev_ids:
        st.markdown(f"**Section IDs:** `{', '.join(ev_ids)}`")
        for eid in ev_ids[:3]:
            chunk = st.session_state.retriever.kb.get_chunk_by_section_id(eid)
            if chunk:
                with st.expander(f"[{chunk.section_id}] {chunk.doc_title}"):
                    st.caption(f"Status: {chunk.status} | Tier: {chunk.doc_type}")
                    st.write(chunk.content[:280] + "...")
    else:
        st.info("No policy documents retrieved for current turn.")

    # 3. Escalation Tickets
    if tm.tickets_created:
        st.markdown("---")
        st.markdown("#### 🎫 Created Human Escalation Tickets")
        for tkt in tm.tickets_created:
            st.success(f"Ticket ID: **{tkt['ticket_id']}** (created=True)\nReason: {tkt['reason']}")
