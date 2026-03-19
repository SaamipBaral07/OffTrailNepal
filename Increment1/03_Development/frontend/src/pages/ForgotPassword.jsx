import { useState } from "react";
import axios from "axios";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/forgot-password",
        { email }
      );
      setMessage(res.data.message);
    } catch (err) {
      setMessage("Something went wrong");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="p-6 border rounded w-80">
        <h2 className="text-xl font-bold mb-4">Forgot Password</h2>

        <input
          className="border p-2 w-full mb-3"
          placeholder="Enter your email"
          onChange={e => setEmail(e.target.value)}
        />

        <button
          className="bg-blue-600 text-white w-full p-2"
          onClick={handleSubmit}
        >
          Send Reset Link
        </button>

        {message && <p className="text-sm mt-3">{message}</p>}
      </div>
    </div>
  );
};

export default ForgotPassword;
