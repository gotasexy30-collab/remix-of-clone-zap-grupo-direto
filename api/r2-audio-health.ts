// Temporary preview-only verification endpoint; remove before merging to production.
const ROOT = 'https://pub-94312f87220e4ebb91acd81b002be102.r2.dev/AUDIOS%20FRONT%20GRUPO%20ZAP/audios/';
const FILENAMES = [...Array.from({ length: 10 }, (_, i) => `audio${String(i+1).padStart(2,'0')}.mp3`), 'audio13.mp3', ...Array.from({ length: 9 }, (_, i) => `audio${i+15}.mp3`), 'notification.mp3'];
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'method'});
  const results = [];
  for (const filename of FILENAMES) {
    try {
      const response = await fetch(ROOT + filename, { method:'GET', headers:{Range:'bytes=0-31'}, signal:AbortSignal.timeout(7000) });
      const contentType = response.headers.get('content-type') || '';
      const bytes = new Uint8Array(await response.arrayBuffer());
      const isMp3 = (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      results.push({filename,ok:response.ok && isMp3,status:response.status,contentType,length:bytes.length,isMp3});
    } catch(e:any) {
      results.push({filename,ok:false,error:e?.message||String(e)});
    }
  }
  return res.status(200).json({total:results.length,ok:results.filter(x=>x.ok).length,results});
}
