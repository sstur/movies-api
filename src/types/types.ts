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
  createdAt: string;
};

export type Movie = {
  id: string;
  title: string;
  overview: string;
  release_date: string;
  genres: Array<string>;
  popularity: number;
  vote_average: number;
  poster_path: string;
  backdrop_path: string;
  favoritedBy: Array<string>;
  comments: Array<string>;
};

export type Comment = {
  id: string;
  movie: string;
  author: string;
  content: string;
  createdAt: string;
};

export type Genre = {
  id: string;
  name: string;
};
