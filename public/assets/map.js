/* ---------------------------------------------------------------------------
   Live C-Layer node map.

   Vanilla port of the c.Email NetworkMapCore component
   (c.email-website/src/components/NetworkMapCore.jsx), kept behaviourally
   identical but restyled dark and rewritten without React/Tailwind, which this
   site does not use. Keep the two in step when either changes.

   Served from public/ rather than inlined so the page's prose dominates its
   markup - some extractors weigh the text-to-script ratio, and this script is
   larger than all the copy on the page. Loaded with `defer`, so it runs after
   the document parses and the elements it queries exist.
--------------------------------------------------------------------------- */
(function(){
  /* The node registry serves both endpoints with Access-Control-Allow-Origin: *,
     so the browser calls it directly - no proxy to deploy and keep alive. */
  const REGISTRY_ORIGIN='https://map.c-layer.certonym.org';

  /* True equirectangular (plate carree). The dotted continents are sampled from
     the equirectangular earth texture and the nodes are projected with the
     identical formula, so a dot always sits on the land it belongs to. The
     latitude band is cropped to drop the empty polar oceans. */
  const LAT_MAX=75, LAT_MIN=-58;
  /* The continent dots are painted onto a canvas, which inherits nothing from
     the cascade, so the colour has to be read out of CSS by hand. It lives in
     tokens.css as --map-land and differs per theme: pale blue over the dark
     card, and a dark slate over the light one, where pale blue would vanish.
     Re-read on theme change rather than cached, since the value moves. */
  const FALLBACK_LAND='rgba(147,197,253,.55)';
  function landColor(){
    var v=getComputedStyle(document.documentElement)
            .getPropertyValue('--map-land').trim();
    return v||FALLBACK_LAND;
  }

  /* prefers-reduced-motion: nothing to do here, deliberately. This file starts
     no animation - the requestAnimationFrame below is a repaint scheduler that
     draws the dot field once per view change, and panToWorld/apply set the
     transform outright with no easing. All motion is either the visitor's own
     drag/zoom (direct manipulation, which reduce-motion is not meant to
     suppress) or the CSS node ping, which global.css already disables under the
     media query. If autonomous motion is ever added - an idle drift, an animated
     fly-to, a pulsing selection - gate it on
     matchMedia('(prefers-reduced-motion: reduce)').matches here. */
  const MIN_SCALE=1, MAX_SCALE=8, BTN_STEP=1.7;
  const IS_APPLE=/Mac|iPhone|iPad|iPod/.test(navigator.platform||'');
  const MODIFIER_HINT=(IS_APPLE?'⌘':'Ctrl')+' + scroll to zoom — drag to pan';

  const vp=document.getElementById('mapvp');
  if(!vp) return;
  const layer=document.getElementById('maplayer');
  const cv=document.getElementById('landcv');
  const mini=document.getElementById('minimap');
  const minicv=document.getElementById('minicv');
  const minirect=document.getElementById('minirect');
  const countEl=document.getElementById('mapcount');
  const hint=document.getElementById('maphint');
  const panel=document.getElementById('nodepanel');

  const view={s:1,x:0,y:0};
  let tex=null, size={w:0,h:0}, nodes=[], selected=null, raf=0, moved=0, interacted=false;
  let landCtx=null;

  const clampS=s=>Math.min(MAX_SCALE,Math.max(MIN_SCALE,s));
  const project=(lat,lng)=>({
    x:Math.max(0,Math.min(100,((lng+180)/360)*100)),
    y:Math.max(0,Math.min(100,((LAT_MAX-lat)/(LAT_MAX-LAT_MIN))*100))
  });
  /* Keep the content covering the viewport so the map can never be dragged into
     empty space. transform-origin is top-left, so visible world-u = -x/(W*s). */
  function clampPan(){
    const W=size.w||vp.clientWidth, H=size.h||vp.clientHeight;
    view.x=Math.min(0,Math.max(W*(1-view.s),view.x));
    view.y=Math.min(0,Math.max(H*(1-view.s),view.y));
  }
  const noPan=e=>e.target.closest&&e.target.closest('[data-nopan]');

  /* Draw the dotted land for the current view. Each screen dot maps to the
     geographic point under it, sampled against the texture. Dots are a fixed
     SCREEN size (gap, r) - that is what keeps them a constant texture at every
     zoom level. One Path2D, one fill, for speed. */
  function drawDotField(ctx,w,h,v,gap,r){
    const {land,TW,TH}=tex;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle=landColor();
    ctx.beginPath();
    for(let sy=0;sy<=h;sy+=gap){
      const vv=(sy-v.y)/(h*v.s);
      if(vv<0||vv>1) continue;
      const lat=LAT_MAX-vv*(LAT_MAX-LAT_MIN);
      const ty=Math.min(TH-1,Math.max(0,Math.round(((90-lat)/180)*TH)));
      for(let sx=0;sx<=w;sx+=gap){
        const uu=(sx-v.x)/(w*v.s);
        if(uu<0||uu>1) continue;
        const lng=uu*360-180;
        const tx=Math.min(TW-1,Math.max(0,Math.round(((lng+180)/360)*TW)));
        if(land[ty*TW+tx]){ ctx.moveTo(sx+r,sy); ctx.arc(sx,sy,r,0,Math.PI*2); }
      }
    }
    ctx.fill();
  }

  function paintLand(){
    if(!tex||!size.w||!size.h) return;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const bw=Math.round(size.w*dpr), bh=Math.round(size.h*dpr);
    if(cv.width!==bw) cv.width=bw;
    if(cv.height!==bh) cv.height=bh;
    const ctx=landCtx||(landCtx=cv.getContext('2d'));
    const gap=Math.max(3,Math.round(size.w/230));
    const r=Math.max(.75,size.w/1000);
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      ctx.setTransform(dpr,0,0,dpr,0,0);
      drawDotField(ctx,size.w,size.h,view,gap,r);
    });
  }

  function paintMini(){
    if(!tex) return;
    const W=minicv.clientWidth||168, H=minicv.clientHeight||Math.round(W*(LAT_MAX-LAT_MIN)/360);
    const dpr=Math.min(2,window.devicePixelRatio||1);
    minicv.width=Math.round(W*dpr); minicv.height=Math.round(H*dpr);
    const ctx=minicv.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    drawDotField(ctx,W,H,{s:1,x:0,y:0},Math.max(2,W/85),Math.max(.6,W/240));
  }

  /* Minimap rectangle tracks the viewport; it only shows once zoomed in. */
  function syncMini(){
    const zoomed=view.s>1.01;
    mini.hidden=!zoomed;
    if(!zoomed||!size.w) return;
    const W=mini.clientWidth, H=mini.clientHeight;
    minirect.style.left=((-view.x/(size.w*view.s))*W)+'px';
    minirect.style.top=((-view.y/(size.h*view.s))*H)+'px';
    minirect.style.width=(W/view.s)+'px';
    minirect.style.height=(H/view.s)+'px';
  }

  function apply(){
    layer.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.s})`;
    /* Markers counter-scale so they stay a constant size. */
    for(const el of layer.children) el.style.transform=`scale(${1/view.s})`;
    paintLand(); syncMini();
  }

  function touched(){ if(!interacted){ interacted=true; hint.hidden=true; } }

  /* Keyboard: arrows pan, +/- zoom, 0 resets. Without this the map is
     mouse/touch only. */
  vp.tabIndex=0;
  vp.setAttribute('role','application');
  vp.setAttribute('aria-label','C-Layer node map. Arrow keys pan, plus and minus zoom, 0 resets.');
  vp.addEventListener('keydown',e=>{
    const step=40;
    switch(e.key){
      case 'ArrowLeft':  view.x+=step; break;
      case 'ArrowRight': view.x-=step; break;
      case 'ArrowUp':    view.y+=step; break;
      case 'ArrowDown':  view.y-=step; break;
      case '+': case '=': zoomTo(view.s*BTN_STEP); e.preventDefault(); return;
      case '-': case '_': zoomTo(view.s/BTN_STEP); e.preventDefault(); return;
      case '0': view.s=1;view.x=0;view.y=0; touched(); apply(); e.preventDefault(); return;
      default: return;
    }
    e.preventDefault(); touched(); clampPan(); apply();
  });

  function zoomTo(next,cx,cy){
    const rect=vp.getBoundingClientRect();
    const px=(cx==null?rect.width/2:cx-rect.left), py=(cy==null?rect.height/2:cy-rect.top);
    const s=clampS(next);
    const wx=(px-view.x)/view.s, wy=(py-view.y)/view.s;
    view.x=px-wx*s; view.y=py-wy*s; view.s=s;
    touched(); clampPan(); apply();
  }

  /* Pan so the world point (uc, vc) sits at the viewport centre - the minimap. */
  function panToWorld(uc,vc){
    view.x=size.w/2-uc*size.w*view.s;
    view.y=size.h/2-vc*size.h*view.s;
    touched(); clampPan(); apply();
  }

  /* Sample the earth texture once, for both the main field and the minimap.
     The RGBA buffer is reduced to a 1-byte-per-pixel land mask and then dropped:
     keeping the full ImageData would retain TW*TH*4 bytes (8.4 MB at 2048x1024)
     for the life of the page, and moving the ocean test here also takes it out
     of the inner repaint loop. */
  function loadTexture(){
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      const TW=img.naturalWidth, TH=img.naturalHeight;
      const c=document.createElement('canvas');
      c.width=TW; c.height=TH;
      /* Read once, so willReadFrequently would only opt into software rendering. */
      const sctx=c.getContext('2d');
      sctx.drawImage(img,0,0);
      let data;
      try{
        data=sctx.getImageData(0,0,TW,TH).data;
      }catch(e){
        /* Same-origin today, so this cannot fire - but a future CDN move would
           break the map, and a silent catch would hide it. */
        console.warn('C-Layer map: earth texture could not be read (cross-origin?)',e);
        return;
      }
      const land=new Uint8Array(TW*TH);
      for(let i=0,p=0;p<land.length;p++,i+=4){
        const rr=data[i], gg=data[i+1], bb=data[i+2];
        land[p]=(bb>rr&&bb>=gg&&bb-Math.max(rr,gg)>=8)?0:1;
      }
      tex={land:land,TW:TW,TH:TH};
      paintLand(); paintMini();
    };
    img.onerror=()=>console.warn('C-Layer map: earth texture failed to load');
    img.src='/assets/earth-texture.jpg';
  }

  /* Deferred until the map nears the viewport. The texture is ~480 KB and the
     map sits well below the fold, so fetching it on load would compete for
     bandwidth with the CSS and fonts the hero needs to paint - and visitors who
     never scroll this far would pay for it regardless. Observing fires
     immediately when the map is already in view (e.g. a /#network deep link). */
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver((entries,obs)=>{
      if(entries.some(e=>e.isIntersecting)){ obs.disconnect(); loadTexture(); }
    },{rootMargin:'200px'});
    io.observe(vp);
  }else{
    loadTexture();
  }

  /* Track the rendered size of the map area. */
  const measure=()=>{
    const r=vp.getBoundingClientRect();
    size={w:r.width,h:r.height};
    clampPan(); apply(); paintMini();
  };
  measure();
  if(window.ResizeObserver) new ResizeObserver(measure).observe(vp);
  else addEventListener('resize',measure);

  /* Repaint both canvases when the theme changes. The dots are baked pixels, so
     unlike everything else on the page they do not follow the cascade - without
     this the continents keep the previous theme's colour until the next resize.
     Two triggers, because the theme has two sources: data-theme for an explicit
     choice, and the OS preference when none is stored. */
  function repaintForTheme(){ paintLand(); paintMini(); }
  if(window.MutationObserver){
    new MutationObserver(repaintForTheme).observe(document.documentElement,
      {attributes:true,attributeFilter:['data-theme']});
  }
  if(window.matchMedia){
    const scheme=matchMedia('(prefers-color-scheme: dark)');
    if(scheme.addEventListener) scheme.addEventListener('change',repaintForTheme);
    else if(scheme.addListener) scheme.addListener(repaintForTheme);
  }

  /* Node markers + selection */
  function showPanel(n){
    selected=n;
    document.getElementById('np-loc').textContent=n.city+', '+n.country;
    document.getElementById('np-ip').textContent=n.ip;
    document.getElementById('np-ver').textContent=n.version;
    panel.hidden=false;
    for(const el of layer.children) el.classList.toggle('is-active',el._ip===n.ip);
  }
  function clearPanel(){
    selected=null; panel.hidden=true;
    for(const el of layer.children) el.classList.remove('is-active');
  }
  document.getElementById('np-close').onclick=clearPanel;

  function addNode(n){
    const p=project(n.lat,n.lng);
    const el=document.createElement('button');
    el.type='button';
    el.className='mapnode';
    el.style.left=p.x+'%'; el.style.top=p.y+'%';
    el.style.transform=`scale(${1/view.s})`;
    el.setAttribute('aria-label','Node in '+n.city+', '+n.country);
    el._ip=n.ip;
    /* Ignore the click that ends a drag. */
    el.addEventListener('click',()=>{ if(moved>5) return; showPanel(n); });
    /* A node focused while zoomed in can sit outside the viewport, so bring it
       into view - otherwise the focus ring is drawn somewhere nobody can see. */
    el.addEventListener('focus',()=>{
      if(view.s>1.01) panToWorld(p.x/100,p.y/100);
    });
    layer.appendChild(el);
  }

  /* Live data. Same two-step as c.Email: registry for the node list, then ipinfo
     per unique IP to place it. */
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const fallback='One network, run by the cDot community around the world.';
  (async()=>{
    try{
      /* Timeout matters as much as error handling here: if the registry hangs
         rather than failing, the count line would read "Connecting…" forever. */
      const res=await fetch(REGISTRY_ORIGIN+'/api/data?limit=200',
                            {signal:AbortSignal.timeout(8000)});
      if(!res.ok) throw new Error('Failed: '+res.status);
      const j=await res.json();
      const data=Array.isArray(j)?j:(j.data||[]);
      if(!data.length){ countEl.textContent=fallback; return; }

      const ipToVersion=new Map();
      data.forEach(d=>{
        const v=(d.json_data&&d.json_data.version)||d.version;
        if(d.client_ip&&v) ipToVersion.set(d.client_ip,v);
      });

      const allIps=[...new Set(data.map(d=>d.client_ip).filter(Boolean))];
      const CAP=30;
      const ips=allIps.slice(0,CAP);   /* geolocating every node would be slow */
      for(let i=0;i<ips.length;i++){
        const ip=ips[i];
        try{
          /* Per-request timeout so one unresolvable IP cannot stall the rest. */
          const r=await fetch(REGISTRY_ORIGIN+'/ipinfo/json/'+ip+'?fields=status,country,city,lat,lon',
                              {signal:AbortSignal.timeout(5000)});
          if(r.ok){
            const g=await r.json();
            if(g.status==='success'&&g.lat!=null&&g.lon!=null){
              const n={lat:parseFloat(g.lat),lng:parseFloat(g.lon),ip:ip,
                       version:ipToVersion.get(ip)||'Unknown',
                       city:g.city||'Unknown',country:g.country||'Unknown'};
              nodes.push(n); addNode(n);
              const cs=new Set(nodes.map(x=>x.country)).size;
              /* Say "of N" when the registry reports more than we plot, rather
                 than implying the network is only ever 30 nodes. */
              const shown=allIps.length>CAP
                ? '<b>'+nodes.length+'</b> of <b>'+allIps.length+'</b> nodes shown'
                : '<b>'+nodes.length+'</b> nodes online';
              countEl.innerHTML=shown+' across <b>'+cs+'</b> countries.';
            }
          }
          if(i<ips.length-1) await wait(100);
        }catch(e){ /* skip unresolved node */ }
      }
      if(!nodes.length) countEl.textContent=fallback;
    }catch(e){
      if(e.name!=='AbortError') countEl.textContent=fallback;
    }
  })();

  /* Wheel zoom requires ctrl/cmd (the Google Maps convention). Without it the
     map would swallow every scroll that crossed it and the page could not be
     scrolled past - on a full-width map mid-page that traps the reader. Pinch
     on a trackpad arrives as a wheel event with ctrlKey set, so pinch still
     zooms with no modifier held. */
  vp.addEventListener('wheel',e=>{
    if(noPan(e)) return;
    if(!e.ctrlKey&&!e.metaKey){ hintModifier(); return; }   /* let the page scroll */
    e.preventDefault();
    zoomTo(view.s*Math.exp(-e.deltaY*0.0015),e.clientX,e.clientY);
  },{passive:false});

  /* Tell people how to zoom the first time they scroll over the map. */
  let hintTimer=0;
  function hintModifier(){
    hint.textContent=MODIFIER_HINT;
    hint.style.display='';
    clearTimeout(hintTimer);
    hintTimer=setTimeout(()=>{ if(interacted) hint.style.display='none'; },1800);
  }

  /* Mouse drag to pan. */
  vp.addEventListener('mousedown',e=>{
    if(e.button!==0||noPan(e)) return;
    moved=0;
    let last={x:e.clientX,y:e.clientY};
    vp.classList.add('drag');
    const move=ev=>{
      const dx=ev.clientX-last.x, dy=ev.clientY-last.y;
      last={x:ev.clientX,y:ev.clientY};
      moved+=Math.abs(dx)+Math.abs(dy);
      view.x+=dx; view.y+=dy;
      touched(); clampPan(); apply();
    };
    const up=()=>{
      vp.classList.remove('drag');
      removeEventListener('mousemove',move); removeEventListener('mouseup',up);
    };
    addEventListener('mousemove',move); addEventListener('mouseup',up);
  });

  /* Touch: TWO fingers pinch-zoom and pan. One finger is left alone so the page
     can always be scrolled by swiping over the map - with touch-action:pan-y in
     CSS, a mobile reader can never get stuck on it. */
  let pan2=null, pinch=null;
  const dist=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const mid=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});
  vp.addEventListener('touchstart',e=>{
    if(noPan(e)) return;
    if(e.touches.length>=2){
      pinch={d:dist(e.touches[0],e.touches[1]),s:view.s};
      pan2=mid(e.touches[0],e.touches[1]);
    }else{ pinch=null; pan2=null; }
  },{passive:true});
  vp.addEventListener('touchmove',e=>{
    if(noPan(e)) return;
    if(e.touches.length<2||!pinch) return;   /* one finger: page scrolls */
    e.preventDefault();
    const a=e.touches[0], b=e.touches[1], m=mid(a,b);
    if(pan2){ view.x+=m.x-pan2.x; view.y+=m.y-pan2.y; }
    pan2=m;
    zoomTo(pinch.s*(dist(a,b)/pinch.d),m.x,m.y);
  },{passive:false});
  vp.addEventListener('touchend',e=>{
    if(e.touches.length<2){ pinch=null; pan2=null; }
  });

  vp.addEventListener('dblclick',e=>{ if(noPan(e)) return; zoomTo(view.s*1.8,e.clientX,e.clientY); });
  vp.addEventListener('dragstart',e=>e.preventDefault());

  /* Minimap: drag or click the rectangle to pan the main map. */
  function miniJump(clientX,clientY){
    const r=minicv.getBoundingClientRect();
    panToWorld(
      Math.min(1,Math.max(0,(clientX-r.left)/r.width)),
      Math.min(1,Math.max(0,(clientY-r.top)/r.height))
    );
  }
  mini.addEventListener('mousedown',e=>{
    e.preventDefault();
    miniJump(e.clientX,e.clientY);
    const move=ev=>miniJump(ev.clientX,ev.clientY);
    const up=()=>{ removeEventListener('mousemove',move); removeEventListener('mouseup',up); };
    addEventListener('mousemove',move); addEventListener('mouseup',up);
  });
  const miniTouch=e=>{ const t=e.touches[0]; if(t) miniJump(t.clientX,t.clientY); };
  mini.addEventListener('touchstart',miniTouch,{passive:true});
  mini.addEventListener('touchmove',miniTouch,{passive:true});

  document.getElementById('mz-in').onclick=()=>zoomTo(view.s*BTN_STEP);
  document.getElementById('mz-out').onclick=()=>zoomTo(view.s/BTN_STEP);
  document.getElementById('mz-fit').onclick=()=>{ view.s=1;view.x=0;view.y=0; touched(); apply(); };
})();
