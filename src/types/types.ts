export type Movie = {
  id: number;
  title: string;
  tagline: string;
  overview: string;
  release_date: string;
  runtime: number;
  genres: Array<Genre>;
  popularity: number;
  vote_average: number;
  poster_path: string;
  backdrop_path: string;
  status: string;
  homepage: string;
};

export type Genre = {
  id: number;
  name: string;
};
