import React, { useState, useEffect, useRef } from 'react';

interface VeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLog: (title: string, desc: string, icon: string) => void;
  onToast: (msg: string) => void;
  onCaptureCanvas: () => string | null;
}

const reassuringMessages = [
  'Initializing Veo 3.1 video diffusion model…',
  'Analyzing spatial geometry and lighting atmosphere…',
  'Synthesizing dynamic atmospheric wind and cloud motion…',
  'Rendering mountain depth and flutter dynamics…',
  'Assembling high-definition video sequence…',
  'Finalizing MP4 video encode…',
];

export const VeoModal: React.FC<VeoModalProps> = ({
  isOpen,
  onClose,
  onAddLog,
  onToast,
  onCaptureCanvas,
}) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    'Cinematic mountain winds sweeping across Himalayan citadel with prayer flags fluttering and natural sunlight'
  );
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(reassuringMessages[0]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const pollRef = useRef<any>(null);
  const msgTimerRef = useRef<any>(null);

  // Initialize with canvas snapshot or army portrait on first open
  useEffect(() => {
    if (isOpen && !sourceImage) {
      const snap = onCaptureCanvas();
      if (snap) {
        setSourceImage(snap);
      } else {
        setSourceImage('/assets/images/magar_infantry_tpose.jpg');
      }
    }
  }, [isOpen, sourceImage, onCaptureCanvas]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (msgTimerRef.current) clearInterval(msgTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSourceImage(ev.target?.result as string);
      onToast('Custom source image loaded');
    };
    reader.readAsDataURL(file);
  };

  const handleSnapshot = () => {
    const snap = onCaptureCanvas();
    if (snap) {
      setSourceImage(snap);
      onToast('Captured 3D realm scene snapshot');
    }
  };

  const handleGenerate = async () => {
    if (!sourceImage) {
      onToast('Please upload an image or snapshot the realm first.');
      return;
    }

    setLoading(true);
    setVideoUrl(null);
    let msgIdx = 0;
    setStatusMessage(reassuringMessages[0]);
    msgTimerRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % reassuringMessages.length;
      setStatusMessage(reassuringMessages[msgIdx]);
    }, 10000);

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: sourceImage,
          mimeType: 'image/jpeg',
          prompt,
          aspectRatio,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to request video generation');
      }

      const { operationName } = await res.json();

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/video-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationName }),
          });

          if (!pollRes.ok) return;
          const pollData = await pollRes.json();

          if (pollData.done) {
            clearInterval(pollRef.current);
            clearInterval(msgTimerRef.current);
            setStatusMessage('Downloading generated video…');

            const downloadRes = await fetch('/api/video-download', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ operationName }),
            });

            if (!downloadRes.ok) throw new Error('Failed to retrieve video stream');
            const videoBlob = await downloadRes.blob();
            const url = URL.createObjectURL(videoBlob);
            setVideoUrl(url);
            setLoading(false);
            onAddLog('Veo Video Generated', 'Created cinematic sequence with Veo 3.1.', '🎥');
            onToast('Veo video generation complete!');
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 4500);
    } catch (err: any) {
      clearInterval(msgTimerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      setLoading(false);
      onToast(`Video generation error: ${err.message || 'Failed'}`);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-window">
        <div className="modal-header">
          <div className="modal-title">
            <span className="veo-modal-icon">🎥</span>
            <div>
              <h3>Veo 3.1 Video Animator</h3>
              <p>Turn Himalayan photos and realm snapshots into dynamic cinematic video</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="veo-grid">
            <div className="veo-left">
              <label className="veo-label">SOURCE FRAME / REALM PHOTO</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-art-source" onClick={handleSnapshot}>
                  📸 Snapshot 3D Scene
                </button>
                <label className="btn-art-source" style={{ cursor: 'pointer' }}>
                  📁 Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {sourceImage && (
                <div style={{ marginTop: '6px' }}>
                  <img
                    src={sourceImage}
                    alt="Source"
                    style={{
                      width: '100%',
                      maxHeight: '140px',
                      objectFit: 'cover',
                      borderRadius: '5px',
                      border: '1px solid #334455',
                    }}
                  />
                </div>
              )}

              <div className="veo-field">
                <label className="veo-label">ANIMATION DIRECTION PROMPT</label>
                <textarea
                  className="veo-input"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe motion (e.g., wind blowing prayer flags, clouds drifting across peaks)..."
                />
              </div>

              <div className="veo-field">
                <label className="veo-label">ASPECT RATIO</label>
                <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cad6e0' }}>
                    <input
                      type="radio"
                      name="veoAspect"
                      value="16:9"
                      checked={aspectRatio === '16:9'}
                      onChange={() => setAspectRatio('16:9')}
                    />
                    16:9 Landscape
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cad6e0' }}>
                    <input
                      type="radio"
                      name="veoAspect"
                      value="9:16"
                      checked={aspectRatio === '9:16'}
                      onChange={() => setAspectRatio('9:16')}
                    />
                    9:16 Vertical
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="btn-veo-generate"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? 'Synthesizing with Veo 3.1…' : '🎥 Generate Video with Veo 3.1'}
              </button>
            </div>

            <div className="veo-right">
              <label className="veo-label">GENERATED VIDEO OUTPUT</label>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '230px',
                  background: '#0e141a',
                  borderRadius: '6px',
                  border: '1px solid #334455',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loading ? (
                  <div className="veo-loading">
                    <div className="veo-spinner-ring"></div>
                    <b>Rendering with Veo 3.1 Fast</b>
                    <p>{statusMessage}</p>
                  </div>
                ) : videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ color: '#6c8194', textAlign: 'center', padding: '24px' }}>
                    Select an image and click Generate Video to animate with Veo 3.1
                  </div>
                )}
              </div>

              {videoUrl && (
                <div style={{ marginTop: '10px' }}>
                  <a
                    href={videoUrl}
                    download="himalayan_realm_animated.mp4"
                    className="btn-art-source"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                  >
                    ⬇️ Download Video (MP4)
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
