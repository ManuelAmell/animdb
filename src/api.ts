export interface SearchResult {
  title: string;
  img: string;
  year: string;
  type: 'movie' | 'series';
  genres: string;
  source: string;
  _score?: number;
}

export async function fetchTMDBResults(query: string): Promise<SearchResult[]> {
  const apiKey = '15d123b384668b5e32607593c78097b6';
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=es-ES&include_adult=false`
    );
    const data = await res.json();
    if (!data.results) return [];
    
    return data.results
      .filter((i: { poster_path: string }) => i.poster_path)
      .map((item: { title?: string; name?: string; poster_path: string; release_date?: string; first_air_date?: string; media_type: string }) => ({
        title: item.title || item.name,
        img: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        type: item.media_type === 'tv' ? 'series' : 'movie',
        genres: '',
        source: 'TMDB'
      }));
  } catch {
    return [];
  }
}

export async function fetchTVMazeResults(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    return data.slice(0, 5).map((item: { show: { name: string; image?: { medium: string }; premiered?: string; type: string; genres: string[] } }) => ({
      title: item.show.name,
      img: item.show.image?.medium || '',
      year: item.show.premiered?.split('-')[0] || '',
      type: item.show.type === 'Movie' ? 'movie' : 'series',
      genres: item.show.genres?.join(', ') || '',
      source: 'Maze'
    }));
  } catch {
    return [];
  }
}

export async function fetchJikanResults(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`);
    const data = await res.json();
    if (!data.data) return [];
    
    return data.data.map((anime: { title: string; images: { jpg: { image_url: string } }; year?: number; type: string; genres: { name: string }[] }) => ({
      title: anime.title,
      img: anime.images?.jpg?.image_url || '',
      year: anime.year?.toString() || '',
      type: anime.type === 'Movie' ? 'movie' : 'series',
      genres: anime.genres?.map((g: { name: string }) => g.name).join(', ') || '',
      source: 'Jikan'
    }));
  } catch {
    return [];
  }
}

export async function fetchByIMDBId(imdbId: string): Promise<SearchResult | null> {
  try {
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=trilogy`);
    const data = await res.json();
    if (data.Response === 'False' || !data.Poster || data.Poster === 'N/A') return null;
    
    return {
      title: data.Title,
      img: data.Poster,
      year: data.Year?.split('-')[0] || data.Year || '',
      type: data.Type === 'movie' ? 'movie' : 'series',
      genres: data.Genre || '',
      source: 'OMDb'
    };
  } catch {
    return null;
  }
}

export async function fetchByAnimeListId(animeListId: string): Promise<SearchResult | null> {
  const idNum = parseInt(animeListId);
  if (isNaN(idNum)) return null;
  
  const kitsuResult = await fetchByKitsuId(animeListId);
  if (kitsuResult) return kitsuResult;
  
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${animeListId}`);
    const data = await res.json();
    if (!data.data) return null;
    
    const anime = data.data;
    return {
      title: anime.title,
      img: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '',
      year: anime.year?.toString() || anime.aired?.prop?.from?.year?.toString() || '',
      type: anime.type === 'Movie' ? 'movie' : 'series',
      genres: anime.genres?.map((g: { name: string }) => g.name).join(', ') || '',
      source: 'MAL'
    };
  } catch {
    return null;
  }
}

export async function fetchByKitsuId(kitsuId: string): Promise<SearchResult | null> {
  try {
    const res = await fetch(`https://kitsu.io/api/edge/anime/${kitsuId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.data) return null;
    
    const anime = data.data.attributes;
    return {
      title: anime.titles.en || anime.canonicalTitle || anime.titles.ja_jp || '',
      img: anime.posterImage?.large || anime.posterImage?.original || anime.posterImage?.small || '',
      year: anime.startDate?.split('-')[0] || '',
      type: anime.subtype === 'movie' ? 'movie' : 'series',
      genres: '',
      source: 'Kitsu'
    };
  } catch {
    return null;
  }
}

export async function fetchITunesResults(query: string, country = 'US'): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=${country}&media=movie&limit=10`
    );
    const data = await res.json();
    if (!data.results) return [];
    
    return data.results.map((item: { trackName?: string; trackId?: number; artworkUrl100?: string; releaseDate?: string; primaryGenreName?: string }) => ({
      title: item.trackName || '',
      img: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '',
      year: item.releaseDate?.split('-')[0] || '',
      type: 'movie' as const,
      genres: item.primaryGenreName || '',
      source: `iTunes (${country})`
    }));
  } catch {
    return [];
  }
}

export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/^(the|a|an|dr\.|mr\.|mrs\.|los|las|el|la)\s+/i, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function smartSearch(
  query: string,
  isAnime: boolean,
  year?: string
): Promise<SearchResult[]> {
  const tasks = [
    fetchTVMazeResults(query),
    fetchJikanResults(query),
    fetchITunesResults(query, 'US'),
    fetchITunesResults(query, 'ES'),
    fetchTMDBResults(query)
  ];

  if (isAnime && (query.length < 5 || /^\d+$/.test(query))) {
    tasks.push(fetchJikanResults(query + ' anime'));
    tasks.push(fetchTMDBResults(query + ' anime'));
  }

  const results = await Promise.all(tasks);
  let combined = results.flat();

  // Deduplicate
  const seen = new Set<string>();
  combined = combined.filter(r => {
    const key = r.title + r.source;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Score results
  const normQ = normalizeTitle(query);
  combined.forEach(r => {
    let score = 0;
    const normTitle = normalizeTitle(r.title);

    if (normTitle === normQ) score += 1000;
    else if (normTitle.startsWith(normQ)) score += 500;
    else if (normTitle.includes(normQ)) score += 100;

    if (year && r.year?.includes(year)) score += 300;
    if (r.img) score += 50;

    if (isAnime) {
      if (r.source === 'Jikan') score += 2000;
      if (r.source === 'TMDB' && r.type === 'movie' && r.title.toLowerCase().includes('anime')) score += 500;
    } else {
      if (r.source === 'Jikan') score -= 500;
    }

    if (r.source === 'TMDB') score += 100;
    if (r.source.includes('iTunes')) score += 10;

    r._score = score;
  });

  combined.sort((a, b) => (b._score || 0) - (a._score || 0));
  return combined;
}