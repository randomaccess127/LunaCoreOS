import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dfpngowpkozggqiyrtrr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcG5nb3dwa296Z2dxaXlydHJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2Mzg1NDIsImV4cCI6MjA5MzIxNDU0Mn0.ikXWcxvjxr3ViJk2eldoJm7Es1uCaDuJ7IqxhGFiCmU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        },
        fetch: (url, options = {}) =>
            fetch(url, {
                ...options,
                cache: 'no-store', // Always bypass browser/CDN cache
            }),
    },
});
