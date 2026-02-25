const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('PIXABAY_API_KEY');
    console.log('API key length:', apiKey?.length, 'starts with:', apiKey?.substring(0, 5));
    const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=10&safesearch=true`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error('Pixabay error:', res.status, text);
      return new Response(JSON.stringify({ error: `Pixabay API error: ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = await res.json();

    const images = (data.hits || []).map((hit: any) => ({
      id: hit.id,
      preview: hit.previewURL,
      web: hit.webformatURL,
      thumb: hit.previewURL,
    }));

    return new Response(JSON.stringify({ images }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
