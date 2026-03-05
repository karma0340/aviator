# Aviator Crash Game ✈️

**Aviator Crash Game** is an exciting and dynamic multiplayer betting game where players test their luck and timing to win big! With a sleek, responsive interface and real-time gameplay powered by cutting-edge technologies, this game offers an engaging experience for users.

## 🌟 Features

### 🎮 Game Mechanics

- **Place Bets**: Choose your bet amount and join the game.
- **Real-Time Multiplier**: Watch the multiplier increase as the plane takes off.
- **Cash Out**: Withdraw your winnings before the plane crashes.
- **Unpredictable Crashes**: Adds excitement and keeps players on edge.

### 📈 Core Highlights

- **Real-Time Updates**: Powered by WebSocket for seamless gameplay.
- **Provably Fair System**: Transparent and verifiable fairness for every round.
- **User-Friendly UI**: Designed with Tailwind CSS for a smooth, responsive experience.
- **Leaderboards**: Track top players and compare performances.

### 🔒 Security & Transparency

- Secure login and gameplay.
- Provably fair crash algorithm ensures trustworthiness.

## 🛠️ Tech Stack

### Frontend

- **React.js**: For building a dynamic and responsive UI.
- **TypeScript:** Ensures robust and scalable code.
- **Tailwind CSS**: Provides a sleek and modern design.
- **Socket.IO**: Enables real-time communication between players and the server.

### Backend

- **Node.js**: High-performance server-side logic.
- **TypeScript**: For type safety and maintainability.
- **Socket.IO**: Real-time communication.
- **MongoDB**: Efficient database for managing user data and game states.

## 📂 Project Structure

```
aviator-crash-game/
├── aviator-frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── assets/
│   │   ├── utils/
├── aviator-backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
```

---

## ⚙️ Setup Instructions

### Frontend

1. Navigate to the `aviator-frontend` directory:
```bash
cd aviator-frontend
```
2. Install dependencies:
```bash
npm install
```
3. Build for production:
```bash
npm run build
```

### Backend
1. Navigate to the `aviator-backend` directory:
```bash
cd aviator-backend
```
2. Install dependencies:
```bash
npm install
```
3. Start the server:
```bash
npm run dev
```

## 🚀 Vercel Deployment

For a seamless deployment of the frontend on Vercel:

1. **Connect Repository**: Point Vercel to this repository.
2. **Root Directory**: Select `aviator-frontend` as the root directory in Vercel settings.
3. **Environment Variables**: Add `REACT_APP_API_URL` with the URL of your deployed backend (e.g., `https://your-backend.render.com`).
4. **Build Settings**: Vercel will automatically detect the settings from `package.json` and `vercel.json`.

> [!IMPORTANT]
> The backend should be deployed separately (e.g., on Render or Railway) as WebSockets (Socket.IO) require a persistent server which Vercel Serverless Functions do not natively support.


## 🎉 How to Play

- Sign up or log in to your account.
- Place your bet and wait for the round to begin.
- Watch the multiplier increase and decide when to cash out.
- Win big if you cash out before the crash!

## 📜 Provably Fair

Each game round is provably fair, ensuring that the outcome is random and cannot be tampered with.

## 🙏 Acknowledgments

- Thanks to the React and Node.js communities for their amazing tools
- Special thanks to all beta testers
