import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;
    
    console.log('Received KYC upload request:', { 
      fileName: file?.name, 
      fileSize: file?.size, 
      fileType: file?.type,
      documentType 
    });
    
    // Validate file exists
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'File too large. Maximum 5MB allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid file type. Only PDF and images (JPEG, PNG) are allowed.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify magic numbers (file signature)
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    const isPDF = bytes[0] === 0x25 && bytes[1] === 0x50 && 
                  bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
    const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && 
                  bytes[2] === 0x4E && bytes[3] === 0x47;
    
    if (!isPDF && !isJPEG && !isPNG) {
      console.error('File signature mismatch:', {
        first4Bytes: Array.from(bytes.slice(0, 4)),
        mimeType: file.type
      });
      return new Response(
        JSON.stringify({ 
          error: 'File content does not match declared file type. File may be corrupted or invalid.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Authenticated user:', user.id);
    
    // Upload file with safe filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const safeFileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    console.log('Uploading to storage:', safeFileName);
    
    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(safeFileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }
    
    console.log('File uploaded successfully, creating submission record');
    
    // Create submission record
    const { data, error: insertError } = await supabase
      .from('kyc_submissions')
      .insert({
        user_id: user.id,
        document_type: documentType,
        document_url: safeFileName,
        status: 'pending'
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Insert error:', insertError);
      // Try to clean up uploaded file
      await supabase.storage.from('kyc-documents').remove([safeFileName]);
      throw insertError;
    }
    
    console.log('KYC submission created successfully:', data.id);
    
    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in upload-kyc-document function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
