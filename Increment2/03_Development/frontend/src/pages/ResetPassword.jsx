import { useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleReset = async () => {
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/reset-password",
        {
          token,
          newPassword: password
        }
      );
      setMessage(res.data.message);
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setMessage("Invalid or expired link");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="p-6 border rounded w-80">
        <h2 className="text-xl font-bold mb-4">Reset Password</h2>

        <input
          className="border p-2 w-full mb-3"
          type="password"
          placeholder="New Password"
          onChange={e => setPassword(e.target.value)}
        />

        <button
          className="bg-green-600 text-white w-full p-2"
          onClick={handleReset}
        >
          Reset Password
        </button>

        {message && <p className="text-sm mt-3">{message}</p>}
      </div>
    </div>
  );
};

export default ResetPassword;
