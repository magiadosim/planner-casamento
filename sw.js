/* Network-first, no persistent cache: always request current PWA assets.
   Never intercept Supabase, authentication, payments or third-party requests. */
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith('/planner-casamento/'))return;
  if(request.mode!=='navigate'&&!/\.(?:js|css|html|webmanifest|svg|png)$/i.test(url.pathname))return;
  event.respondWith(fetch(request,{cache:'no-store'}));
});
