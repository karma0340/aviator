/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from "react";
import { useLocation } from "react-router";
import { io, Socket } from "socket.io-client";
import { toast } from "react-toastify";
import { config } from "./config";
import {
  UserType,
  BettedUserType,
  GameHistory,
  ContextType,
  ContextDataType,
  MsgUserType,
  GameBetLimit,
  UserStatusType,
  GameStatusType,
  SeedDetailsType,
  unityContext as sharedUnityContext,
  init_state as sharedInitState,
} from "./utils/interfaces";

export interface PlayerType {
  auto: boolean;
  betted: boolean;
  cashouted: boolean;
  betAmount: number;
  cashAmount: number;
  target: number;
}

const Context = React.createContext<ContextType>(null!);

const socket: Socket = io(config.wss, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  timeout: 20000,
  forceNew: false
});

export const callCashOut = (at: number, index: "f" | "s") => {
  let data = { type: index, endTarget: at };
  socket.emit("cashOut", data);
};

let fIncreaseAmount = 0;
let fDecreaseAmount = 0;
let sIncreaseAmount = 0;
let sDecreaseAmount = 0;

let newState;
let newBetState;

export const Provider = ({ children }: any) => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  let token = query.get("cert");

  if (!token) {
    // Generate a random demo token if none provided
    token = `demo_${Math.random().toString(36).substring(2, 9)}`;
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?cert=${token}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  }

  const [state, setState] = React.useState<ContextDataType>(sharedInitState);
  const [msgData, setMsgData] = React.useState<MsgUserType[]>([]);
  const [msgTab, setMsgTab] = React.useState<boolean>(false);
  const [msgReceived, setMsgReceived] = React.useState<boolean>(false);
  const [errorBackend, setErrorBackend] = React.useState<boolean>(false);
  const [fLoading, setFLoading] = React.useState<boolean>(false);
  const [sLoading, setSLoading] = React.useState<boolean>(false);
  const [isDemo, setIsDemo] = React.useState<boolean>(true); // Default to demo for initial load

  // Handle Demo Mode Balance Toggle
  React.useEffect(() => {
    if (isDemo) {
      setState(prev => ({
        ...prev,
        userInfo: { ...prev.userInfo, balance: 10000, currency: "DEMO" }
      }));
      toast.info("Switched to Demo Mode - 10,000 credits added!");
    } else {
      // Re-fetch real info if needed, or stick to current socket balance
      socket.emit("enterRoom", { token });
    }
  }, [isDemo]);

  newState = state;
  const [unity, setUnity] = React.useState({
    unityState: false,
    unityLoading: false,
    currentProgress: 0,
  });
  const [gameState, setGameState] = React.useState({
    currentNum: "0",
    currentSecondNum: 0,
    GameState: "",
    time: 0,
  });

  const [bettedUsers, setBettedUsers] = React.useState<BettedUserType[]>([]);
  const update = (attrs: Partial<ContextDataType>) => {
    setState((prev) => ({ ...prev, ...attrs }));
  };
  const [previousHand, setPreviousHand] = React.useState<UserType[]>([]);
  const [history, setHistory] = React.useState<number[]>([]);
  const [userBetState, setUserBetState] = React.useState<UserStatusType>({
    fbetState: false,
    fbetted: false,
    sbetState: false,
    sbetted: false,
  });
  newBetState = userBetState;
  const [rechargeState, setRechargeState] = React.useState(false);
  const [currentTarget, setCurrentTarget] = React.useState(0);
  const emittedBetsRef = React.useRef<{ [key: number]: Set<string> }>({});
  const updateUserBetState = (attrs: Partial<UserStatusType>) => {
    setUserBetState((prev) => ({ ...prev, ...attrs }));
  };

  const [betLimit, setBetLimit] = React.useState<GameBetLimit>({
    maxBet: 1000,
    minBet: 1,
  });
  React.useEffect(function () {
    // Unity loading event handlers
    sharedUnityContext.on("loaded", () => {
      console.log("✅ Unity WebGL loaded successfully");
      setUnity({
        currentProgress: 100,
        unityLoading: true,
        unityState: true,
      });
    });

    sharedUnityContext.on("error", (error) => {
      console.error("🔴 Unity WebGL error:", error);
      setUnity({
        currentProgress: 0,
        unityLoading: false,
        unityState: false,
      });
    });

    sharedUnityContext.on("GameController", function (message) {
      console.log("🎮 Unity message:", message);
      if (message === "Ready") {
        setUnity({
          currentProgress: 100,
          unityLoading: true,
          unityState: true,
        });
      }
    });

    sharedUnityContext.on("progress", (progression) => {
      const currentProgress = progression * 100;
      console.log(`📊 Unity loading progress: ${currentProgress.toFixed(1)}%`);
      if (progression === 1) {
        setUnity({ currentProgress, unityLoading: true, unityState: true });
      } else {
        setUnity({ currentProgress, unityLoading: false, unityState: false });
      }
    });

    return () => sharedUnityContext.removeAllEventListeners();
  }, []);

  React.useEffect(() => {
    // Socket connection event handlers
    socket.on("connect", () => {
      console.log("✅ Connected to backend server");
      setErrorBackend(false);
      socket.emit("enterRoom", { token });
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from backend server");
      setErrorBackend(true);
    });

    socket.on("connect_error", (error) => {
      console.error("🔴 Connection error:", error);
      setErrorBackend(true);
    });

    socket.on("bettedUserInfo", (bettedUsers: BettedUserType[]) => {
      setBettedUsers(bettedUsers);
    });

    socket.on("myBetState", (user: UserType) => {
      setUserBetState(prev => ({
        ...prev,
        fbetState: false,
        fbetted: user.f.betted,
        sbetState: false,
        sbetted: user.s.betted,
      }));
    });

    socket.on("myInfo", (user: UserType) => {
      update({
        userInfo: {
          ...state.userInfo,
          balance: user.balance,
          userType: user.userType,
          userName: user.userName,
          currency: user.currency || "INR",
          isSoundEnable: user.isSoundEnable,
          isMusicEnable: user.isMusicEnable,
          token: user.token,
          userId: user.userId,
          f: user.f,
          s: user.s
        }
      });
    });

    socket.on("history", (history: any) => {
      setHistory(history);
    });

    socket.on("gameState", (gameState: GameStatusType) => {
      setGameState(gameState);
    });

    socket.on("previousHand", (previousHand: UserType[]) => {
      setPreviousHand(previousHand);
    });

    socket.on("finishGame", (user: UserType) => {
      // Use the latest functional state to avoid closure issues
      setState(prevState => {
        const nextState = { ...prevState };
        const fauto = nextState.userInfo.f.auto;
        const sauto = nextState.userInfo.s.auto;
        const fbetAmount = nextState.userInfo.f.betAmount;
        const sbetAmount = nextState.userInfo.s.betAmount;

        nextState.userInfo = { ...user };
        nextState.userInfo.f.betAmount = fbetAmount;
        nextState.userInfo.s.betAmount = sbetAmount;
        nextState.userInfo.f.auto = fauto;
        nextState.userInfo.s.auto = sauto;

        // Functional updates for bet status
        setUserBetState(prevBetState => {
          const nextBetStatus = { ...prevBetState };

          if (!user.f.betted) {
            nextBetStatus.fbetted = false;
            if (nextState.userInfo.f.auto) {
              if (user.f.cashouted) {
                // Autoplay logic... (simplified for stability)
                nextBetStatus.fbetState = true;
              } else {
                nextBetStatus.fbetState = true;
              }
            }
          }
          if (!user.s.betted) {
            nextBetStatus.sbetted = false;
            if (user.s.auto) {
              nextBetStatus.sbetState = true;
            }
          }
          return nextBetStatus;
        });

        return nextState;
      });
    });

    socket.on("getBetLimits", (betAmounts: { max: number; min: number }) => {
      setBetLimit({ maxBet: betAmounts.max, minBet: betAmounts.min });
    });

    socket.on("recharge", () => {
      setRechargeState(true);
    });

    socket.on("error", (data) => {
      setUserBetState(prev => ({
        ...prev,
        [`${data.index}betted`]: false,
        [`${data.index}betState`]: false
      }));
      toast.error(data.message);
    });

    socket.on("success", (data) => {
      toast.success(data);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("myBetState");
      socket.off("myInfo");
      socket.off("history");
      socket.off("gameState");
      socket.off("previousHand");
      socket.off("finishGame");
      socket.off("getBetLimits");
      socket.off("recharge");
      socket.off("error");
      socket.off("success");
    };
  }, [socket]);

  React.useEffect(() => {
    if (gameState.GameState === "BET") {
      const roundId = gameState.time; // Using time or roundId as a proxy for the current round uniqueness
      if (!emittedBetsRef.current[roundId]) {
        emittedBetsRef.current[roundId] = new Set();
      }

      const emitted = emittedBetsRef.current[roundId];

      // Logic for Panel F
      if (userBetState.fbetState && !userBetState.fbetted && !emitted.has('f')) {
        if (state.userInfo.balance >= state.userInfo.f.betAmount) {
          const data = {
            betAmount: state.userInfo.f.betAmount,
            target: state.fautoCashoutState ? state.userInfo.f.target : 0,
            type: "f",
            auto: state.userInfo.f.auto,
          };
          emitted.add('f');
          socket.emit("playBet", data);
          updateUserBetState({ fbetState: false, fbetted: true });
          update({ userInfo: { ...state.userInfo, balance: state.userInfo.balance - state.userInfo.f.betAmount } });
        } else if (state.userInfo.f.auto) {
          toast.error("Low balance. Autoplay F stopped.");
          updateUserInfo({ f: { ...state.userInfo.f, auto: false } });
          updateUserBetState({ fbetState: false });
        }
      }

      // Logic for Panel S
      if (userBetState.sbetState && !userBetState.sbetted && !emitted.has('s')) {
        if (state.userInfo.balance >= state.userInfo.s.betAmount) {
          const data = {
            betAmount: state.userInfo.s.betAmount,
            target: state.sautoCashoutState ? state.userInfo.s.target : 0,
            type: "s",
            auto: state.userInfo.s.auto,
          };
          emitted.add('s');
          socket.emit("playBet", data);
          updateUserBetState({ sbetState: false, sbetted: true });
          update({ userInfo: { ...state.userInfo, balance: state.userInfo.balance - state.userInfo.s.betAmount } });
        } else if (state.userInfo.s.auto) {
          toast.error("Low balance. Autoplay S stopped.");
          updateUserInfo({ s: { ...state.userInfo.s, auto: false } });
          updateUserBetState({ sbetState: false });
        }
      }
    }
  }, [gameState.GameState, gameState.time, userBetState.fbetState, userBetState.sbetState, state.userInfo.balance]);

  const getMyBets = async () => {
    try {
      const response = await fetch(`${config.api}/my-info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: state.userInfo.userName }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status) {
          update({ myBets: data.data as GameHistory[] });
        }
      } else {
        console.error("Error:", response.statusText);
      }
    } catch (error) {
      console.log("getMyBets", error);
    }
  };

  useEffect(() => {
    if (gameState.GameState === "BET") getMyBets();
  }, [gameState.GameState]);

  const updateUserInfo = (attrs: Partial<UserType>) => {
    setState(prev => ({
      ...prev,
      userInfo: { ...prev.userInfo, ...attrs }
    }));
  };
  const handleGetSeed = () => {
    toast.info(`Server Seed: ${state.seed || 'Generating...'}`);
  };
  const handleGetSeedOfRound = async (id: number): Promise<SeedDetailsType> => {
    try {
      const response = await fetch(`${config.api}/game/seed/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.userInfo.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        throw new Error('Failed to fetch seed details');
      }
    } catch (error) {
      console.error('Error fetching seed details:', error);
      // Return default data structure to prevent errors
      return {
        createdAt: new Date().toISOString(),
        serverSeed: '',
        seedOfUsers: [],
        flyDetailID: id
      };
    }
  };
  const handlePlaceBet = () => {
    // Simple trigger for UI feedback
    toast.success("Bet instruction received!");
  };
  const toggleMsgTab = () => setMsgTab((prev) => !prev);
  const handleChangeUserSeed = (seedCode: string) => {
    setState(prev => ({
      ...prev,
      userInfo: { ...prev.userInfo, clientSeed: seedCode }
    }));
    toast.success("Client seed updated for next round");
  };

  return (
    <Context.Provider
      value={{
        ...state,
        ...gameState,
        ...userBetState,
        ...betLimit,
        state,
        userInfo: state.userInfo,
        socket,
        msgData,
        msgTab,
        msgReceived,
        setMsgReceived,
        errorBackend,
        unityState: unity.unityState,
        unityLoading: unity.unityLoading,
        currentProgress: unity.currentProgress,
        bettedUsers,
        previousHand,
        history,
        rechargeState,
        myUnityContext: sharedUnityContext,
        currentTarget,
        fLoading,
        setFLoading,
        sLoading,
        setSLoading,
        setCurrentTarget,
        update: (attrs) => setState((prev) => ({ ...prev, ...attrs })),
        updateUserInfo,
        getMyBets,
        updateUserBetState,
        setMsgData,
        handleGetSeed,
        handleGetSeedOfRound,
        handlePlaceBet,
        toggleMsgTab,
        handleChangeUserSeed,
        isDemo,
        setIsDemo,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export default Context;
