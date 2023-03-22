export type User = {
  id: string;
  name: string;
  username: string;
  password: string;
  favorites: Array<string>;
};

export type Session = {
  id: string;
  user: string;
  created_at: string;
};

export type Movie = {
  id: string;
  title: string;
  overview: string;
  release_date: string;
  genre_ids: Array<string>;
  popularity: number;
  vote_average: number;
  poster_path: string;
  backdrop_path: string;
  favorited_by: Array<string>;
  comments: Array<string>;
};

export type Comment = {
  id: string;
  movie: string;
  author: string;
  content: string;
  created_at: string;
};

export type Genre = {
  id: string;
  name: string;
};
