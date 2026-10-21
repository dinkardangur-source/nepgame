import React, { useState } from 'react';

interface ImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetArmyPortrait: (url: string) => void;
  onAddLog: (title: string, desc: string, icon: string) => void;
  onToast: (msg: string) => void;
}

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  isOpen,
  onClose,
  onSetArmyPortrait,
  onAddLog,
  onToast,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [prompt, setPrompt] = useState(
    'Magar Himalayan Vanguard infantry warrior in traditional armored tunic with steel khukuri, isometric character art'
  );
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    '/assets/images/magar_infantry_tpose.jpg'
  );

  if (!isOpen) return null;

  const handleUseMagarTpose = async () => {
    try {
      const res = await fetch('/assets/images/magar_infantry_tpose.jpg');
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        setBaseImage(e.target?.result as string);
        setIsEditMode(true);
        onToast('Level 1 Magar Infantry loaded as base image');
      };
      reader.readAsDataURL(blob);
    } catch {
      onToast('Could not load Magar T-Pose base image');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBaseImage(ev.target?.result as string);
      setIsEditMode(true);
      onToast('Custom base image loaded for editing');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      onToast('Please enter a prompt or instructions.');
      return;
    }

    setLoading(true);
    setStatusText(
      isEditMode
        ? 'Editing image with gemini-nano-banana-2.1…'
        : 'Synthesizing 3D character art with gemini-nano-banana-2.1…'
    );

    try {
      const payload: any = {
        prompt,
        aspectRatio,
        imageSize,
      };

      if (isEditMode && baseImage) {
        payload.imageBase64 = baseImage;
        payload.mimeType = 'image/jpeg';
      }

      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Image generation failed');
      }

      setGeneratedImageUrl(data.imageUrl);
      onAddLog(
        'AI Art Created',
        isEditMode
          ? 'Edited concept art with gemini-nano-banana-2.1.'
          : 'Generated 3D character art with gemini-nano-banana-2.1.',
        '🎨'
      );
      onToast(isEditMode ? 'Image edited successfully!' : 'Art generated with Nano Banana 2.1!');
    } catch (err: any) {
      onToast(`Art generation error: ${err.message || 'Failed'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-window">
        <div className="modal-header">
          <div className="modal-title">
            <span className="veo-modal-icon art-modal-icon">🎨</span>
            <div>
              <h3>AI Realm Art Studio</h3>
              <p>Create & edit 3D character designs and environments using gemini-nano-banana-2.1</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="veo-grid">
            <div className="veo-left">
              <div className="art-mode-switch">
                <button
                  type="button"
                  className={`btn-mode ${!isEditMode ? 'active' : ''}`}
                  onClick={() => setIsEditMode(false)}
                >
                  ✨ Create New Art
                </button>
                <button
                  type="button"
                  className={`btn-mode ${isEditMode ? 'active' : ''}`}
                  onClick={() => {
                    setIsEditMode(true);
                    if (!baseImage) handleUseMagarTpose();
                  }}
                >
                  🖌️ Edit Character / Image
                </button>
              </div>

              {isEditMode && (
                <div className="art-source-picker">
                  <label className="veo-label">BASE REFERENCE IMAGE</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-art-source" onClick={handleUseMagarTpose}>
                      ⚔️ Magar Infantry T-Pose
                    </button>
                    <label className="btn-art-source" style={{ cursor: 'pointer' }}>
                      📁 Upload Custom
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>

                  {baseImage && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={baseImage}
                        alt="Base Reference"
                        style={{
                          width: '48px',
                          height: '48px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #487294',
                        }}
                      />
                      <small style={{ color: '#a0b6c6' }}>Base reference loaded for editing</small>
                    </div>
                  )}
                </div>
              )}

              <div className="veo-field">
                <label className="veo-label">PROMPT / EDIT INSTRUCTIONS</label>
                <textarea
                  className="veo-input"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your character or scene details..."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className="veo-label">ASPECT RATIO</label>
                  <select
                    className="veo-select"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                  >
                    <option value="1:1">1:1 Square</option>
                    <option value="3:4">3:4 Portrait</option>
                    <option value="9:16">9:16 Tall</option>
                    <option value="16:9">16:9 Widescreen</option>
                    <option value="4:3">4:3 Landscape</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="veo-label">RESOLUTION</label>
                  <select
                    className="veo-select"
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value)}
                  >
                    <option value="1K">1K Standard HD</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="btn-veo-generate"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading
                  ? statusText
                  : isEditMode
                  ? '🖌️ Edit Image with Nano Banana 2.1'
                  : '✨ Generate Art with Nano Banana 2.1'}
              </button>
            </div>

            <div className="veo-right">
              <label className="veo-label">PREVIEW & ACTIONS</label>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1',
                  background: '#11171d',
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
                    <b>{statusText}</b>
                    <p>Rendering with gemini-nano-banana-2.1…</p>
                  </div>
                ) : generatedImageUrl ? (
                  <img
                    src={generatedImageUrl}
                    alt="Generated Art"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ color: '#688094', textAlign: 'center', padding: '20px' }}>
                    Enter a prompt and click Generate
                  </div>
                )}
              </div>

              {generatedImageUrl && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn-art-source"
                    onClick={() => {
                      onSetArmyPortrait(generatedImageUrl);
                      onToast('Updated army portrait with new art!');
                    }}
                  >
                    🛡️ Set as Army Portrait
                  </button>
                  <a
                    href={generatedImageUrl}
                    download="himalayan_art.png"
                    className="btn-art-source"
                    style={{ textDecoration: 'none', textAlign: 'center' }}
                  >
                    ⬇️ Download
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
