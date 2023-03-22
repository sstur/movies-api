export type User = {
  id: number;
  name: string;
  username: string;
  password: string;
  favorites: Array<number>;
};

export type Session = {
  id: number;
  user: number;
  created_at: string;
};

export type Movie = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  genre_ids: Array<number>;
  popularity: number;
  vote_average: number;
  poster_path: string;
  backdrop_path: string;
  favorited_by: Array<number>;
  comments: Array<number>;
};

export type Comment = {
  id: number;
  movie: number;
  author: number;
  content: string;
  created_at: string;
};

export type Genre = {
  id: number;
  name: string;
};
