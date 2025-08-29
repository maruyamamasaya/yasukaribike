import { useRouter } from 'next/router';
import { useEffect, useState, useCallback, DragEvent } from 'react';

const PUBLIC_BASE = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || 'https://rebikele-file.s3.ap-northeast-1.amazonaws.com';

type ImgInfo = {
  filename: string;
};

export default function UploaderPage() {
  const router = useRouter();
  const { key } = router.query as { key?: string };
  const [files, setFiles] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchList = useCallback(async () => {
    if (!key) return;
    const res = await fetch(`/uploader/api/images/${key}?format=json`);
    if (!res.ok) return;
    const data = await res.json();
    setFiles(data.files || []);
    setThumbnail(data.thumbnail || null);
  }, [key]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleFiles = (filesList: FileList | null) => {
    if (!filesList) return;
    setSelected(prev => [...prev, ...Array.from(filesList)]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const upload = async () => {
    if (!key) return;
    setUploading(true);
    for (const file of selected) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const res = await fetch('/uploader/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ext })
      });
      if (!res.ok) continue;
      const data = await res.json();
      await fetch(data.presignedUrl, { method: 'PUT', body: file });
    }
    setSelected([]);
    await fetchList();
    setUploading(false);
  };

  const remove = async (filename: string) => {
    if (!key) return;
    await fetch(`/uploader/api/images/${key}/${filename}`, { method: 'DELETE' });
    await fetchList();
  };

  const setThumb = async (filename: string) => {
    if (!key) return;
    await fetch('/uploader/api/thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, filename })
    });
    await fetchList();
  };

  const copyCsv = async () => {
    if (!key) return;
    const res = await fetch(`/uploader/api/images/${key}?format=csv`);
    if (!res.ok) return;
    const text = await res.text();
    await navigator.clipboard.writeText(text);
  };

  return (
    <div>
      <h1>Uploader: {key}</h1>
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        style={{ border: '2px dashed #ccc', padding: '20px', marginBottom: '10px' }}
      >
        Drag & Drop images here
      </div>
      <input type="file" multiple accept="image/*" onChange={e => handleFiles(e.target.files)} />
      <button onClick={upload} disabled={uploading || selected.length === 0}>
        Upload
      </button>
      <button onClick={copyCsv}>Copy CSV</button>
      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '20px' }}>
        {files.map(f => {
          const url = `${PUBLIC_BASE}/keys/${key}/${f}`;
          return (
            <div key={f} style={{ margin: '10px', border: '1px solid #ddd', padding: '10px' }}>
              <img src={url} alt={f} style={{ width: '150px', height: '150px', objectFit: 'cover' }} />
              <div>{f}</div>
              <button onClick={() => navigator.clipboard.writeText(url)}>Copy URL</button>
              <button onClick={() => remove(f)}>Delete</button>
              <button onClick={() => setThumb(f)}>{thumbnail === f ? '★' : '☆'}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
