import "./Scanner.css";
import { useEffect, useRef, useState } from "react";
import { repeatedCameraFrame } from "../shared/synchronization";
import { createWorker } from "tesseract.js";
import { api } from "./api";
import { image } from "../shared/model";
import type { Card } from "../shared/model";
import { scanQueries, visiblePrintingHint } from "../shared/scanner";
export default function Scanner({
  onSelect,
  initialImage,
  onBack,
  onSearch,
  onImageConsumed,
}: {
  onSelect: (c: Card) => void;
  onBack?: () => void;
  onSearch?: () => void;
  initialImage?: string | null;
  onImageConsumed?: () => void;
}) {
  const nativeScanRef = useRef<(image: string) => void>(() => {});
  useEffect(() => {
    nativeScanRef.current = (image) => {
      void recognize(image).finally(() => onImageConsumed?.());
    };
  });
  useEffect(() => {
    if (initialImage) nativeScanRef.current(initialImage);
  }, [initialImage]);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [cameraState,setCameraState]=useState<'starting'|'live'|'paused'|'denied'|'unavailable'>('starting');
  const [view,setView]=useState<'camera'|'review'>('camera');
  const [settings,setSettings]=useState(false);
  const mounted=useRef(false),cameraRequest=useRef(0),cameraPending=useRef(false);
  function stopCamera(){cameraRequest.current++;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;setActive(false);setCameraState('paused');}
  useEffect(()=>{
    mounted.current=true;
    const requestState=cameraRequest;
    const frame=requestAnimationFrame(()=>{if(!initialImage)void camera();});
    const hide=()=>{if(document.hidden)stopCamera();};document.addEventListener('visibilitychange',hide);
    return()=>{mounted.current=false;cancelAnimationFrame(frame);requestState.current++;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;document.removeEventListener('visibilitychange',hide);};
  // Startup belongs to this scanner visit; permissions remain browser-controlled.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [continuous, setContinuous] = useState(true);
  const captureRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState(
    "Use clear lighting and fill the frame with one card.",
  );
  const [queue, setQueue] = useState<
    {
      text: string;
      confidence: number;
      cards: Card[];
      hint: ReturnType<typeof visiblePrintingHint>;
    }[]
  >(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("cardchasm-scan-review") || "[]",
      );
      return Array.isArray(saved)
        ? saved
            .filter((q) => typeof q.text === "string" && Array.isArray(q.cards))
            .slice(-100)
        : [];
    } catch {
      return [];
    }
  });
  const workerRef = useRef<ReturnType<typeof createWorker> | null>(null);
  const lastFrame = useRef<{ signature: string; at: number } | null>(null);
  useEffect(() => {
    try {
      sessionStorage.setItem("cardchasm-scan-review", JSON.stringify(queue));
    } catch {
      setStatus(
        "Review queue could not be saved on this device. Keep this page open until saved.",
      );
    }
  }, [queue]);
  useEffect(
    () => () => {
      void workerRef.current?.then((w) => w.terminate()).catch(() => {});
      workerRef.current = null;
    },
    [],
  );
  useEffect(
    () => () => stream.current?.getTracks().forEach((t) => t.stop()),
    [],
  );
  async function camera() {
    if(cameraPending.current||stream.current)return;
    if(!navigator.mediaDevices?.getUserMedia){setCameraState('unavailable');setStatus('Camera unavailable here. Upload a photo or search for a card.');return;}
    const request=++cameraRequest.current;cameraPending.current=true;setCameraState('starting');
    try{
      const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
      if(!mounted.current||request!==cameraRequest.current){next.getTracks().forEach(t=>t.stop());return;}
      stream.current=next;
      if(video.current){video.current.srcObject=next;await video.current.play();}
      if(!mounted.current||request!==cameraRequest.current){next.getTracks().forEach(t=>t.stop());return;}
      setActive(true);setCameraState('live');setStatus('Frame one card. Tap the shutter to scan.');
      next.getVideoTracks()[0]?.addEventListener('ended',()=>{if(mounted.current&&request===cameraRequest.current)stopCamera();},{once:true});
    }catch(error){
      if(!mounted.current||request!==cameraRequest.current)return;
      stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setActive(false);
      const denied=error instanceof DOMException&&['NotAllowedError','SecurityError'].includes(error.name);
      setCameraState(denied?'denied':'unavailable');setStatus(denied?'Camera access was not granted. Allow it in browser settings, retry, or upload a photo.':'Camera unavailable. Retry, upload a photo, or search for a card.');
    }finally{cameraPending.current=false;}
  }
  async function recognize(source: string | File, cameraFrame = false) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    try {
      workerRef.current ||= createWorker("eng");
      const worker = await workerRef.current;
      setStatus("Reading card text on this device…");
      const { data } = await worker.recognize(source);
      const lines = scanQueries(data.text);
      const signature = lines.slice(0, 2).join("|").toLowerCase();
      if (
        repeatedCameraFrame(
          lastFrame.current,
          signature,
          cameraFrame,
          Date.now(),
        )
      ) {
        if (lastFrame.current) lastFrame.current.at = Date.now();
        setStatus("Duplicate frame skipped.");
        return;
      }
      const candidates: Card[] = [];
      for (const line of lines) {
        try {
          const result = await api<{ data: string[] }>(
            `/cards?mode=autocomplete&q=${encodeURIComponent(line)}`,
          );
          for (const name of result.data.slice(0, 2)) {
            const card = await api<Card>(
              `/cards?mode=named&q=${encodeURIComponent(name)}`,
            );
            if (!candidates.some((c) => c.oracle_id === card.oracle_id))
              candidates.push(card);
          }
        } catch {
          /* Try another OCR line; never create guessed cards. */
        }
        if (candidates.length >= 2) break;
      }
      if (cameraFrame && candidates.length && signature)
        lastFrame.current = { signature, at: Date.now() };
      if(!mounted.current)return;
      setQueue((q) => [
        ...q,
        {
          text: data.text,
          confidence: data.confidence,
          cards: candidates,
          hint: visiblePrintingHint(data.text),
        },
      ]);
      if(!cameraFrame){stopCamera();setView("review");}
      setStatus(
        candidates.length
          ? "Review identity and printing. Matches require explicit saving."
          : "No verified match. Try a sharper image or card search.",
      );
    } catch (e) {
      void workerRef.current?.then((w) => w.terminate()).catch(() => {});
      workerRef.current = null;
      setStatus(
        "Could not read this image. Try a sharper photo or card search. " +
          (e as Error).message,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function capture() {
    if (!active||!video.current||!video.current.videoWidth||!video.current.videoHeight) {setStatus('Camera is not ready yet. Wait for the live preview.');return;}
    const c = document.createElement("canvas");
    c.width = video.current.videoWidth;
    c.height = video.current.videoHeight;
    c.getContext("2d")?.drawImage(video.current, 0, 0);
    void recognize(c.toDataURL("image/png"), true);
  }
  useEffect(() => {
    captureRef.current = capture;
  });
  useEffect(() => {
    if (!continuous || !active) return;
    const timer = setInterval(() => {
      if (!busyRef.current) captureRef.current();
    }, 4000);
    return () => clearInterval(timer);
  }, [continuous, active]);
  function review(){stopCamera();setView('review');setSettings(false);}
  function resume(){setView('camera');setSettings(false);void camera();}
  return (
    <section className={"scanner-workflow scan-view-"+view} aria-label="Card scanner">
      <header className="scan-header">
        <button aria-label={view==='review'?'Back to camera':'Back to tools'} onClick={view==='review'?resume:onBack}>‹</button>
        <div><span className="scan-brand">STACKSYNERGY</span><h1>{view==='review'?'Review scans':'Scan'}</h1></div>
        <button aria-label="Scan settings" aria-expanded={settings} onClick={()=>setSettings(v=>!v)}>⚙</button>
      </header>
      {settings&&<div className="scan-settings"><label className="checkbox"><input type="checkbox" checked={continuous} disabled={!active} onChange={e=>setContinuous(e.target.checked)}/>Automatic capture every 4 seconds</label><p>Each match stays in review until you choose a printing and save it. A repeated frame is skipped; use Scan another copy for duplicates.</p><p>Use even lighting, a plain background and one card at a time. Text recognition can be wrong; always check the result.</p><button onClick={()=>setSettings(false)}>Done</button></div>}
      <div className="scan-camera-pane" hidden={view!=='camera'}>
        <div className="scan-viewfinder" aria-label={active?'Live camera preview':'Camera preview unavailable'}>
          <video ref={video} playsInline muted className={active?'scan-live-video':'scan-live-video hidden'}/>
          <div className="scan-frame" aria-hidden="true"><i/><i/><i/><i/></div>
          <span className="scan-live-label">{active?'Camera on':cameraState==='starting'?'Opening camera…':cameraState==='denied'?'Camera permission needed':cameraState==='paused'?'Camera paused':'Camera unavailable'}</span>
          {!active&&<div className="scan-camera-fallback"><span aria-hidden="true">▣</span><h2>{cameraState==='starting'?'Your camera opens here':cameraState==='denied'?'Allow camera access':cameraState==='paused'?'Ready when you are':'Use a photo instead'}</h2><p>{cameraState==='starting'?'If prompted, allow camera access to scan a card.':cameraState==='denied'?'Check your browser camera permission, then try again.':'You can upload a card photo or search by name.'}</p>{cameraState!=='starting'&&<button onClick={()=>void camera()}>Retry camera</button>}</div>}
          <button className="scan-auto-control" aria-label="Automatic capture" aria-pressed={continuous} disabled={!active} onClick={()=>setContinuous(v=>!v)}>ϟ</button>
          {active&&<p className="scan-frame-caption">Keep one card inside the frame</p>}
        </div>
        <p className="scan-status" role="status">{busy?'Reading card text on this device…':status}</p>
        <div className="scan-capture-controls">
          <label className="scan-photo-control"><span aria-hidden="true">▧</span><span>Photos</span><input type="file" accept="image/*" multiple disabled={busy} onChange={async e=>{for(const f of Array.from(e.target.files||[]))await recognize(f);e.target.value='';}}/></label>
          <button className="scan-shutter" aria-label="Capture card" disabled={!active||busy} onClick={capture}><span/></button>
          <button className="scan-queue-control" aria-label="Review scans" onClick={review}><strong>{queue.length}</strong><span>Review</span></button>
        </div>
        <div className="scan-secondary-controls">{active&&<button onClick={stopCamera}>Pause camera</button>}{active&&queue.length>0&&<button disabled={busy} onClick={()=>{lastFrame.current=null;capture();}}>Scan another copy</button>}<button onClick={onSearch}>Search instead</button></div>
      </div>
      {view==='review'&&<div className="scan-review-pane"><div className="scan-review-heading"><h2>{queue.length} {queue.length===1?'scan':'scans'} to review</h2><p>Check the match, then choose printing, copies and destination. Nothing is added automatically.</p></div>{!queue.length&&<div className="scan-empty"><span aria-hidden="true">▣</span><h3>No cards scanned yet</h3><p>Scan a card or choose a photo to begin.</p><button onClick={resume}>Return to camera</button></div>}{queue.map((q,i)=>(
        <article key={i} className="scan-review">
          <div className="scan-review-number"><span>SCAN {i+1}</span><button aria-label={'Dismiss scan '+(i+1)} onClick={()=>setQueue(v=>v.filter((_,j)=>j!==i))}>×</button></div>
          {q.cards.length?q.cards.map(c=><button key={c.id} className="scan-match" onClick={()=>onSelect(c)}>{image(c)&&<img src={image(c)} alt="" width={52} loading="lazy"/>}<span><strong>{c.name}</strong><small>{c.set?.toUpperCase()} · #{c.collector_number} · {c.lang||'en'}</small><span className="scan-match-action">Printing, copies & destination →</span></span></button>):<div className="scan-no-match"><h3>No verified match</h3><p>Try a sharper photo or find the card by name.</p><button onClick={onSearch}>Search for card</button></div>}
          {q.hint&&<p className="scan-printing-hint">Possible footer: {q.hint.set.toUpperCase()} #{q.hint.collector}. Confirm the printing.</p>}
          <details><summary>Recognition details</summary><p>Text confidence: {Math.round(q.confidence)}%. This does not verify card identity.</p><pre>{q.text}</pre></details>
        </article>
      ))}</div>}
    </section>
  );
}
