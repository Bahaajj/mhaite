/* Add this helper to the citizen-facing form page when implementing real file uploads. */
window.uploadCitizenAttachments = async function uploadCitizenAttachments(fileList, supabaseClient) {
  const files = Array.from(fileList || []);
  if (!files.length) return [];
  if (!supabaseClient?.storage) throw new Error('Supabase client is required to upload attachments.');
  const maxSize = 10 * 1024 * 1024;
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
  const uploaded = [];
  for (const file of files) {
    if (file.size > maxSize) throw new Error(`الملف ${file.name} أكبر من 10MB.`);
    if (!allowed.has(file.type)) throw new Error(`نوع الملف ${file.name} غير مدعوم. استخدم PDF أو JPG أو PNG أو WebP.`);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || 'attachment';
    const path = `citizens/${crypto.randomUUID()}/${Date.now()}-${safeName}`;
    const { error } = await supabaseClient.storage.from('municipality-submissions').upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    // Save this metadata array into citizen_submissions.attachments, not the file contents.
    uploaded.push({ name: file.name, path, size: file.size, type: file.type });
  }
  return uploaded;
};
