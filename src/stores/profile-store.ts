import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PlayerRatings {
  rapid?: number;
  blitz?: number;
  bullet?: number;
}

interface ProfileState {
  /** Chess.com username */
  chessComUsername: string;
  /** Lichess username */
  lichessUsername: string;
  /** Cached ratings from Chess.com */
  chessComRatings: PlayerRatings | null;
  /** Cached ratings from Lichess */
  lichessRatings: PlayerRatings | null;
  /** Whether we're currently fetching ratings */
  isFetching: boolean;
}

interface ProfileActions {
  setChessComUsername: (username: string) => void;
  setLichessUsername: (username: string) => void;
  setChessComRatings: (ratings: PlayerRatings | null) => void;
  setLichessRatings: (ratings: PlayerRatings | null) => void;
  setIsFetching: (val: boolean) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState & ProfileActions>()(
  persist(
    (set) => ({
      chessComUsername: "",
      lichessUsername: "",
      chessComRatings: null,
      lichessRatings: null,
      isFetching: false,
      setChessComUsername: (username) =>
        set({ chessComUsername: username, chessComRatings: null }),
      setLichessUsername: (username) =>
        set({ lichessUsername: username, lichessRatings: null }),
      setChessComRatings: (ratings) => set({ chessComRatings: ratings }),
      setLichessRatings: (ratings) => set({ lichessRatings: ratings }),
      setIsFetching: (val) => set({ isFetching: val }),
      clearProfile: () =>
        set({
          chessComUsername: "",
          lichessUsername: "",
          chessComRatings: null,
          lichessRatings: null,
        }),
    }),
    {
      name: "chess-analyzer-profile",
      partialize: (state) => ({
        chessComUsername: state.chessComUsername,
        lichessUsername: state.lichessUsername,
        chessComRatings: state.chessComRatings,
        lichessRatings: state.lichessRatings,
      }),
    }
  )
);
