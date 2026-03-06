import React, { useEffect } from "react";
// import { useCrashContext } from "../context";
import { toast } from 'react-toastify';
import Context, { callCashOut, callCancelBet } from "../../context";

interface BetProps {
	index: 'f' | 's'
	add: boolean
	setAdd: any
}
type FieldNameType = 'betAmount' | 'decrease' | 'increase' | 'singleAmount'
type BetOptType = '1' | '2' | '5' | '10' | '20' | '50' | '100' | '1000'
type GameType = 'manual' | 'auto'

const Bet = ({ index, add, setAdd }: BetProps) => {
	const context = React.useContext(Context)
	const { state,
		fbetted, sbetted,
		fbetState, sbetState,
		GameState,
		currentSecondNum,
		minBet, maxBet,
		currentTarget,
		update,
		updateUserBetState
	} = context;
	const [cashOut, setCashOut] = React.useState(2);

	const auto = index === 'f' ? state.userInfo.f.auto : state.userInfo.s.auto
	const betted = index === 'f' ? fbetted : sbetted
	const deState = index === 'f' ? state.fdeState : state.sdeState
	const inState = index === 'f' ? state.finState : state.sinState
	const betState = index === 'f' ? fbetState : sbetState
	const decrease = index === 'f' ? state.fdecrease : state.sdecrease
	const increase = index === 'f' ? state.fincrease : state.sincrease
	const autoCound = index === 'f' ? state.fautoCound : state.sautoCound
	const betAmount = index === 'f' ? state.userInfo.f.betAmount : state.userInfo.s.betAmount
	const autoCashoutState = index === 'f' ? state.fautoCashoutState : state.sautoCashoutState
	const single = index === 'f' ? state.fsingle : state.ssingle
	const singleAmount = index === 'f' ? state.fsingleAmount : state.ssingleAmount

	const [gameType, setGameType] = React.useState<GameType>("manual");
	const [betOpt, setBetOpt] = React.useState<BetOptType>("1");
	const [showModal, setShowModal] = React.useState(false);
	const [myBetAmount, setMyBetAmount] = React.useState(10);
	// const { index } = props;

	const minus = (type: FieldNameType) => {
		let value = { ...state };
		if (type === "betAmount") {
			if (betAmount - 1.0 < minBet) {
				value.userInfo[index][type] = minBet
			} else {
				value.userInfo[index][type] = Math.max(minBet, Number((Number(betAmount) - 1.0).toFixed(0)))
			}
		} else {
			if (value[`${index + type}`] - 1.0 < 1.0) {
				value[`${index + type}`] = 1.0
			} else {
				value[`${index + type}`] = Number((Number(value[`${index + type}`]) - 1.0).toFixed(0))
			}
		}
		update(value);
	}

	const plus = (type: FieldNameType) => {
		let value = { ...state };
		if (type === "betAmount") {
			if (value.userInfo[index][type] + 1.0 > state.userInfo.balance) {
				value.userInfo[index][type] = Math.floor(state.userInfo.balance)
			} else {
				if (value.userInfo[index][type] + 1.0 > maxBet) {
					value.userInfo[index][type] = maxBet;
				} else {
					value.userInfo[index][type] = Number((Number(betAmount) + 1.0).toFixed(0))
				}
			}
		} else {
			if (value[`${index + type}`] + 1.0 > state.userInfo.balance) {
				value[`${index + type}`] = Math.floor(state.userInfo.balance)
			} else {
				value[`${index + type}`] = Number((Number(value[`${index + type}`]) + 1.0).toFixed(0))
			}
		}
		update(value);
	}

	const manualPlus = (amount: number, btnNum: BetOptType) => {
		let value = state
		if (betOpt === btnNum) {
			if (Number((betAmount + amount)) > maxBet) {
				value.userInfo[index].betAmount = maxBet
			} else {
				value.userInfo[index].betAmount = Number((betAmount + amount).toFixed(2))
			}
		} else {
			value.userInfo[index].betAmount = Number(Number(amount).toFixed(2))
			setBetOpt(btnNum);
		}
		update(value);
	}

	const changeBetType = (e: GameType) => {
		updateUserBetState({ [`${index}betState`]: false });
		setGameType(e);
	}

	const onChangeBlur = (e: number, type: 'cashOutAt' | 'decrease' | 'increase' | 'singleAmount') => {
		let value = state;
		if (type === "cashOutAt") {
			if (e < 1.01) {
				value.userInfo[index]['target'] = 1.01;
				setCashOut(1.01);
			} else {
				value.userInfo[index]['target'] = Math.round(e * 100) / 100
				setCashOut(Math.round(e * 100) / 100);
			}
		} else {
			if (e < 0.1) {
				value[`${index + type}`] = 0.1;
			} else {
				value[`${index + type}`] = Math.round(e * 100) / 100;
			}
		}
		update(value);
	}

	const onBetClick = (s: boolean) => {
		updateUserBetState({ [`${index}betState`]: s })
	}
	const setCount = (amount: number) => {
		let attrs = state;
		attrs[`${index}autoCound`] = amount;
		update(attrs);
	}

	const reset = () => {
		update({
			[`${index}autoCound`]: 0,
			[`${index}decrease`]: 0,
			[`${index}increase`]: 0,
			[`${index}singleAmount`]: 0,
			[`${index}deState`]: false,
			[`${index}inState`]: false,
			[`${index}single`]: false,
		})
	}

	const onAutoBetClick = (_betState: boolean) => {
		let attrs = state;
		attrs.userInfo[index].auto = _betState;
		update(attrs);

		updateUserBetState({ [`${index}betState`]: _betState });

		if (!state) {
			setCount(0);
		}
	}

	const onStartBtnClick = () => {
		if (autoCound > 0) {
			// Validation for active limits
			if (deState && decrease <= 0) {
				toast.error("Please specify a valid stop-loss amount");
				return;
			}
			if (inState && increase <= 0) {
				toast.error("Please specify a valid stop-profit amount");
				return;
			}
			if (single && singleAmount <= 0) {
				toast.error("Please specify a valid single-win limit");
				return;
			}

			// All good, start autoplay
			onAutoBetClick(true);
			setShowModal(false);
		} else {
			toast.error("Please set number of rounds");
		}
	}
	useEffect(() => {
		if (betted) {
			if (autoCashoutState) {
				if (cashOut < currentSecondNum) {
					updateUserBetState({ [`${index}betted`]: false });
					callCashOut(cashOut, index);
				}
			}
		}
	}, [currentSecondNum, fbetted, sbetted, state.fautoCashoutState, state.sautoCashoutState, state.userInfo.f.target, state.userInfo.s.target, autoCashoutState, betted, cashOut, index, updateUserBetState])

	useEffect(() => {
		setMyBetAmount(betAmount);
	}, [betAmount])

	return (
		<div className="bet-control">
			<div className="controls">
				{index === 'f' ? !add && (
					<div className="sec-hand-btn add" onClick={() => setAdd(true)}></div>
				) : add &&
				<div className="sec-hand-btn minus" onClick={() => setAdd(false)}></div>
				}
				<div className="navigation">
					<div className="navigation-switcher">
						{(betted || betState) ?
							<>
								<button className={gameType === "manual" ? "active" : ""} >Bet</button>
								<button className={gameType === "auto" ? "active" : ""} >Auto</button>
							</> :
							<>
								<button className={gameType === "manual" ? "active" : ""} onClick={() => changeBetType("manual")}>Bet</button>
								<button className={gameType === "auto" ? "active" : ""} onClick={() => changeBetType("auto")}>Auto</button>
							</>
						}
					</div>
				</div>
				<div className="first-row">
					<div className="bet-block">
						<div className="bet-spinner">
							<div className={`spinner ${betState || betted ? "disabled" : ""}`}>
								<div className="buttons">
									<button className="minus" onClick={() => betState || betted ? "" : minus("betAmount")}></button>
								</div>
								<div className="input">
									{betState || betted ?
										<input type="number" value={Number(myBetAmount)} readOnly ></input>
										:
										<input type="number" value={Number(myBetAmount)}
											onChange={e => {
												Number(e.target.value) > maxBet ? update({ ...state, userInfo: { ...state.userInfo, [`${index}`]: { betAmount: maxBet } } }) : Number(e.target.value) < 0 ? update({ ...state, userInfo: { ...state.userInfo, [`${index}`]: { betAmount: 0 } } }) :
													update({ ...state, userInfo: { ...state.userInfo, [`${index}`]: { betAmount: Number(e.target.value) } } });
											}}></input>
									}
								</div>
								<div className="buttons">
									<button className="plus" onClick={() => betState || betted ? "" : plus("betAmount")}></button>
								</div>
							</div>
						</div>
						{betState || betted ?
							<div className="bet-opt-list">
								<button className="bet-opt disabled">
									<span>10</span>
								</button>
								<button className="bet-opt disabled">
									<span>20</span>
								</button>
								<button className="bet-opt disabled">
									<span>50</span>
								</button>
								<button className="bet-opt disabled">
									<span>100</span>
								</button>
							</div>
							:
							<div className="bet-opt-list">
								<button onClick={() => manualPlus(10, "10")} className="bet-opt">
									<span>10</span>
								</button>
								<button onClick={() => manualPlus(20, "20")} className="bet-opt">
									<span>20</span>
								</button>
								<button onClick={() => manualPlus(50, "50")} className="bet-opt">
									<span>50</span>
								</button>
								<button onClick={() => manualPlus(100, "100")} className="bet-opt">
									<span>100</span>
								</button>
							</div>
						}
					</div>
					<div className="buttons-block">
						{betted ? GameState === "PLAYING" ?
							<button className="btn-waiting" onClick={() => {
								updateUserBetState({ [`${index}betted`]: false, [`${index}betState`]: false });
								callCashOut(currentTarget, index);
							}}>
								<span className="cashout-label-wrap">
									<label className="cashout-label">CASHOUT</label>
									<label className="amount">
										<span>{(betAmount * currentTarget).toFixed(2)}</span>
										<span className="currency">{state.userInfo?.currency || 'INR'}</span>
									</label>
								</span>
							</button>
							: <button className="btn-danger">WAITING</button> : betState ?
							<>
								<div className="btn-tooltip">Waiting for next round</div>
								<button className="btn-danger h-[70%]" onClick={() => {
									onBetClick(false);
									update({ ...state, [`${index}autoCound`]: 0, userInfo: { ...state.userInfo, [index]: { ...state.userInfo[index], auto: false } } })
									callCancelBet(index);
								}}><label>CANCEL</label></button>
							</> :
							<button onClick={() => onBetClick(true)} className="btn-success">
								<span className="bet-label-wrap">
									<label className="bet-label">BET</label>
									<label className="amount">
										<span>{Number(betAmount).toFixed(2)}</span>
										<span className="currency">{state.userInfo?.currency || 'INR'}</span>
									</label>
								</span>
							</button>
						}
					</div>
				</div>
				{/* Auto */}
				{
					gameType === "auto" &&
					<>
						<div className="border-line"></div>
						<div className="second-row">
							<div className="auto-bet-wrapper">
								<div className="auto-bet">
									{auto ? (
										<button onClick={() => {
											onAutoBetClick(false);
											setCount(0);
										}} className="auto-play-btn btn-danger" >{autoCound}</button>
									) : (
										<button onClick={() => { setShowModal(true); }} className="auto-play-btn btn-primary">AUTO PLAY</button>
									)}
								</div>
							</div>
							<div className="cashout-block">
								<div className="cashout-switcher">
									<label className="label">Auto Cash Out</label>
									{betted || betState ? (
										<div className={`input-switch ${autoCashoutState ? "" : "off"}`}>
											<span className="oval"></span>
										</div>
									) : (
										<div onClick={() => { update({ [`${index}autoCashoutState`]: !autoCashoutState }) }} className={`input-switch ${autoCashoutState ? "" : "off"}`}>
											<span className="oval"></span>
										</div>
									)}
								</div>
								<div className="cashout-snipper-wrapper">
									<div className="cashout-snipper">
										<div className={`snipper small ${autoCashoutState && !betState ? "" : "disabled"}`}>
											<div className="input">
												{autoCashoutState && !betState ? (
													<input type="number"
														onChange={(e) => { update({ ...state, userInfo: { ...state.userInfo, [`${index}`]: { ...state.userInfo[index], target: Number(e.target.value) } } }); setCashOut(Number(e.target.value)) }}
														value={cashOut}
														onBlur={(e) => onChangeBlur(Number(e.target.value) || 0, "cashOutAt")}
													/>
												) : (
													<input type="number" value={cashOut.toFixed(2)} readOnly />
												)}
											</div>
											<span className="text">x</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</>
				}
			</div >
			{showModal &&
				<div className="modal">
					<div onClick={() => setShowModal(false)} className="back"></div>
					<div className="modal-dialog">
						<div className="modal-content">
							<div className="modal-header">
								<span>Auto play options</span>
								<button className="close" onClick={() => setShowModal(false)}>
									<span>x</span>
								</button>
							</div>
							<div className="modal-body">
								<div className="content-part content-part-1">
									<span>Number of Rounds:</span>
									<div className="rounds-wrap">
										<button
											className={`btn-secondary ${autoCound === 10 ? "onClick" : ""}`}
											onClick={() => setCount(10)}>
											10</button>
										<button
											className={`btn-secondary ${autoCound === 20 ? "onClick" : ""}`}
											onClick={() => setCount(20)}>
											20</button>
										<button
											className={`btn-secondary ${autoCound === 50 ? "onClick" : ""}`}
											onClick={() => setCount(50)}>
											50</button>
										<button
											className={`btn-secondary ${autoCound === 100 ? "onClick" : ""}`}
											onClick={() => setCount(100)}>
											100</button>
									</div>
								</div>
								<div className="content-part">
									<div className={`input-switch ${deState ? "" : "off"}`}
										onClick={() => {
											update({ [`${index}deState`]: !deState, [`${index}decrease`]: 0 });
										}}
									>
										<span className="oval"></span>
									</div>
									<span className="title">Stop if cash decreases by</span>
									<div className="spinner">
										{deState ?
											<div className="m-spinner">
												<div className="buttons">
													<button onClick={() => minus("decrease")} className="minus"></button>
												</div>
												<div className="input">
													<input type="number" onChange={(e) => update({ [`${index}decrease`]: Number(e.target.value) })} value={decrease}
														onBlur={(e) => onChangeBlur(Number(e.target.value) || 0, "decrease")}
													/>
												</div>
												<div className="buttons">
													<button onClick={() => plus("decrease")} className="plus"></button>
												</div>
											</div> :
											<div className="m-spinner disabled">
												<div className="buttons">
													<button disabled className="minus"></button>
												</div>
												<div className="input">
													<input type="number" readOnly value={Number(decrease).toFixed(2)} />
												</div>
												<div className="buttons">
													<button disabled className="plus"></button>
												</div>
											</div>}
									</div>
									<span >INR</span>
								</div>
								<div className="content-part">
									<div className={`input-switch ${inState ? "" : "off"}`}
										onClick={() => {
											update({ [`${index}inState`]: !inState, [`${index}increase`]: 0 });
										}}
									>
										<span className="oval"></span>
									</div>
									<span className="title">Stop if cash increases by</span>
									<div className="spinner">
										{inState ? <div className="m-spinner">
											<div className="buttons">
												<button onClick={() => minus("increase")} className="minus"></button>
											</div>
											<div className="input">
												<input type="number" onChange={(e) => update({ [`${index}increase`]: Number(e.target.value) })} value={increase}
													onBlur={(e) => onChangeBlur(Number(e.target.value), "increase")}
												/>
											</div>
											<div className="buttons">
												<button onClick={() => plus("increase")} className="plus"></button>
											</div>
										</div> : <div className="m-spinner disabled">
											<div className="buttons">
												<button disabled className="minus"></button>
											</div>
											<div className="input">
												<input type="number" readOnly value={Number(increase).toFixed(2)} />
											</div>
											<div className="buttons">
												<button disabled className="plus"></button>
											</div>
										</div>}
									</div>
									<span >INR</span>
								</div>
								<div className="content-part">
									<div className={`input-switch ${single ? "" : "off"}`}
										onClick={() => {
											update({ [`${index}single`]: !single, [`${index}singleAmount`]: 0 });
										}}
									>
										<span className="oval"></span>
									</div>
									<span className="title">Stop if single win exceeds</span>
									<div className="spinner">
										{!!single ?
											<div className="m-spinner">
												<div className="buttons">
													<button onClick={() => minus("singleAmount")} className="minus"></button>
												</div>
												<div className="input">
													<input type="number" onChange={(e) => update({ [`${index}singleAmount`]: Number(e.target.value) })} value={singleAmount}
														onBlur={(e) => onChangeBlur(Number(e.target.value), "singleAmount")}
													/>
												</div>
												<div className="buttons">
													<button onClick={() => plus("singleAmount")} className="plus" ></button>
												</div>
											</div> :
											<div className="m-spinner disabled">
												<div className="buttons ">
													<button disabled className="minus"></button>
												</div>
												<div className="input">

													<input type="number" readOnly value={singleAmount.toFixed(2)} />
												</div>
												<div className="buttons">
													<button disabled className="plus"></button>
												</div>
											</div>
										}
									</div>
									<span >INR</span>
								</div>
							</div>
							<div className="modal-footer">
								<div className="btns-wrapper">
									<button className="reset-btn btn-waiting" onClick={reset}>Reset</button>
									<button className="start-btn btn-success" onClick={onStartBtnClick}>Start</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			}
		</div >
	)
}

export default Bet