import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Board } from '../components/Board';
import { TerminalBanner } from '../components/TerminalBanner';

// e.g. "P0 wins (greedy)", "draw (repetition)", "truncated"
function outcomeText(rep: any): string {
  const o = rep?.outcome || {};
  const cat: string | null = o.category ?? null;
  if (!cat) return 'outcome n/a';
  if (cat === 'goal' && o.winner !== null && o.winner !== undefined) {
    const spec = rep?.agents?.[String(o.winner)]?.spec;
    return `P${o.winner} wins${spec ? ` (${spec})` : ''}`;
  }
  if (cat.startsWith('draw_')) return `draw (${cat.slice(5).replace(/_/g, ' ')})`;
  return cat.replace(/_/g, ' ');
}

const isFinal = (file: string) => file.startsWith('final_');

export const ReplaysPage: React.FC = () => {
  const [replays, setReplays] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [query, setQuery] = useState<string>('');
  // Final-rule results live in experiments/results/final_*; older folders predate rule changes (see STALE.md).
  const [finalOnly, setFinalOnly] = useState<boolean>(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const [activeReplayData, setActiveReplayData] = useState<any | null>(null);
  const [currentPly, setCurrentPly] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Load replays
  useEffect(() => {
    // shortcut: with a typed query and finalOnly, final rows are filtered from the server's first 50 matches only;
    // add a server-side folder filter if that ever hides results.
    api.fetchReplays(0, 50, query || (finalOnly ? 'final_' : ''))
      .then((res) => {
        const items = finalOnly ? res.items.filter((it: any) => isFinal(it.file)) : res.items;
        setReplays(items);
        setTotal(finalOnly && query ? items.length : res.total);
        if (items.length > 0 && !selectedItem) {
          loadReplay(items[0]);
        }
      })
      .catch(console.error);
  }, [query, finalOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadReplay = async (item: any) => {
    setSelectedItem(item);
    setLoading(true);
    setIsPlaying(false);
    setCurrentPly(0);
    try {
      const data = await api.fetchReplayItem(item.file, item.index);
      setActiveReplayData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load replay');
    } finally {
      setLoading(false);
    }
  };

  // Upload custom replay
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setLoading(true);
        const data = await api.uploadReplay(json);
        setActiveReplayData(data);
        setSelectedItem({ match_id: json.match_id || file.name, length: json.length || json.replay?.length });
        setCurrentPly(0);
      } catch (err: any) {
        alert(err.message || 'Failed to parse replay file');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Scrubber playback
  const maxPly = activeReplayData?.frames ? activeReplayData.frames.length - 1 : 0;
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentPly((prev) => {
        if (prev >= maxPly) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(timer);
  }, [isPlaying, maxPly]);

  const currentFrameState = activeReplayData?.frames?.[currentPly];

  return (
    <div className="main-content" data-testid="replays-page">
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Replay Catalog */}
        <div className="card">
          <div className="card-title">
            <span>Match replays ({total})</span>
            <label className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>
              Upload
              <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <div className="form-group">
            <input
              type="text"
              className="form-input"
              placeholder="Filter by file or match ID"
              aria-label="Filter replays by file or match ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 400 }}>
            <input type="checkbox" checked={finalOnly} onChange={(e) => setFinalOnly(e.target.checked)} />
            Final-rule results only
          </label>
          {!finalOnly && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
              Rows marked "older rules" come from folders made before the final rule changes.{' '}
              <code>experiments/results/STALE.md</code> lists which still hold.
            </p>
          )}
          {replays.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No replays match{query ? ` "${query}"` : ''}{finalOnly ? ' in the final-rule results' : ''}.
            </p>
          )}

          <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {replays.map((rep, idx) => {
              const isSelected = selectedItem?.file === rep.file && selectedItem?.index === rep.index;
              return (
                <div
                  key={`${rep.file}-${rep.index}-${idx}`}
                  onClick={() => loadReplay(rep)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rep.match_id}
                  </div>
                  <div style={{ color: isSelected ? '#ffffff' : 'var(--text-muted)', fontSize: '0.75rem' }}>
                    <div>{rep.file.split('/')[0]} · {rep.config_label}{isFinal(rep.file) ? '' : ' · older rules'}</div>
                    <div>{outcomeText(rep)} · {rep.length} plies</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Replay Viewer & Scrubber */}
        <div className="board-container">
          {loading && <p>Loading frames and verifying replay...</p>}

          {activeReplayData?.verified && (
            <div
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
                backgroundColor: activeReplayData.verified.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: activeReplayData.verified.ok ? '#10b981' : '#ef4444',
                border: `1px solid ${activeReplayData.verified.ok ? '#10b981' : '#ef4444'}`,
              }}
            >
              {activeReplayData.verified.ok ? '✓ Deterministic Replay Verified' : `⚠ ${activeReplayData.verified.message}`}
            </div>
          )}

          {currentFrameState && (
            <>
              <TerminalBanner terminal={currentFrameState.terminal} />

              <Board
                state={currentFrameState}
                showPaths={true}
                interactive={false}
              />

              {/* Scrubber Controls */}
              <div className="card" style={{ width: '100%', maxWidth: '500px', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Ply: <strong>{currentPly}</strong> / {maxPly}</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn" onClick={() => setCurrentPly(Math.max(0, currentPly - 1))} disabled={currentPly === 0}>
                      ◀
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsPlaying(!isPlaying)}>
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button className="btn" onClick={() => setCurrentPly(Math.min(maxPly, currentPly + 1))} disabled={currentPly >= maxPly}>
                      ▶
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max={maxPly}
                  value={currentPly}
                  onChange={(e) => setCurrentPly(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
