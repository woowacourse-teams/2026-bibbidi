import "./App.css";
import { LoginForm } from "./features/login";
import { SignupForm } from "./features/signup";

function App() {
  const isLoginPage = window.location.pathname === "/login";

  return (
    <main className="auth-page">
      {isLoginPage ? <LoginForm /> : <SignupForm />}
    </main>
  );
}

export default App;
