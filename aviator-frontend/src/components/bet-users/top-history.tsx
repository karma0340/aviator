import React, { useEffect } from "react";
import MoonLoader from "react-spinners/MoonLoader";
import "./bets.scss";
import { config } from "../../config";
import Context from "../../context";

const TopHistory = () => {
  const { userInfo } = React.useContext(Context);
  const [type, setType] = React.useState(0);
  const [history, setHistory] = React.useState([]);
  const [loadingEffect, setLoadingEffect] = React.useState(false);

  const callDate = async (date: string) => {
    try {
      setLoadingEffect(true);
      const response = await fetch(`${config.api}/get-${date}-history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.data);
        setTimeout(() => {
          setLoadingEffect(false);
        }, 500);
      } else {
        console.log(`HTTP error! status: ${response.status}`);
      }
    } catch (error: any) {
      console.log("callDate", error);
    }
  };
  useEffect(() => {
    // Request of Day data
    callDate("day");
  }, []);
  return (
    <>
      <div className="navigation-switcher-wrapper">
        <div className="navigation-switcher">
          <div
            className="slider"
            style={{ transform: `translate(${100 * type}px)` }}
          ></div>
          <button
            onClick={() => {
              setType(0);
              callDate("day");
            }}
            className={`tab ${type === 0 ? "active" : ""}`}
          >
            Day
          </button>
          <button
            onClick={() => {
              setType(1);
              callDate("month");
            }}
            className={`tab ${type === 1 ? "active" : ""}`}
          >
            Month
          </button>
          <button
            onClick={() => {
              setType(2);
              callDate("year");
            }}
            className={`tab ${type === 2 ? "active" : ""}`}
          >
            Year
          </button>
        </div>
      </div>
      <div className="top-list-wrapper">
        <div className="top-items-list scroll-y h-100">
          {loadingEffect ? (
            <div className="flex items-center justify-center top-14">
              <MoonLoader
                color="red"
                size={35}
                data-testid="loader"
              />
            </div>
          ) : (
            <>
              {history.map((item: any, index: number) => (
                <div key={index} className="bet-item">
                  <div className="main">
                    <div className="icon">
                      <img
                        className="avatar"
                        alt="avatar"
                        src="/avatars/av-5.png"
                      ></img>
                      <div className="username">d***3</div>
                    </div>
                    <div className="score">
                      <div className="flex">
                        <div className="">
                          <span>Bet, {userInfo?.currency || 'INR'}:&nbsp;</span>
                          <span></span>
                        </div>
                        <span className="amount">
                          {item.betAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex">
                        <div className="">
                          <span>Cashed out:&nbsp;</span>
                        </div>
                        <span className="amount cashout">
                          {item.cashoutAt.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex">
                        <div className="">
                          <span>Win, {userInfo?.currency || 'INR'}: &nbsp;</span>
                        </div>
                        <span className="amount">
                          {(item.cashoutAt * item.betAmount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default TopHistory;
