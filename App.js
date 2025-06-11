import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({
    ExpenseName: "",
    Amount: "",
    Date: "",
    Description: ""
  });

  const API_BASE = "http://localhost:5000/api/expenses";

  const fetchExpenses = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get-expenses`);
      setExpenses(res.data.data);
    } catch (err) {
      alert("Failed to fetch expenses");
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      await axios.post(`${API_BASE}/add-expense`, form);
      alert("Expense added!");
      setForm({ ExpenseName: "", Amount: "", Date: "", Description: "" });
      fetchExpenses();
    } catch (err) {
      alert("Error adding expense");
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  return (
    <div className="container">
      <h2>Expense Tracker</h2>

      <div className="form">
        <input
          type="text"
          name="ExpenseName"
          value={form.ExpenseName}
          placeholder="Expense Name"
          onChange={handleChange}
        />
        <input
          type="number"
          name="Amount"
          value={form.Amount}
          placeholder="Amount"
          onChange={handleChange}
        />
        <input
          type="date"
          name="Date"
          value={form.Date}
          onChange={handleChange}
        />
        <textarea
          name="Description"
          value={form.Description}
          placeholder="Description"
          onChange={handleChange}
        />
        <button onClick={handleSubmit}>Add Expense</button>
      </div>

      <div className="list">
        <h3>All Expenses</h3>
        {expenses.map((exp) => (
          <div className="item" key={exp._id}>
            <strong>{exp.ExpenseName}</strong> - ₹{exp.Amount}<br />
            <small>{new Date(exp.Date).toLocaleDateString()}</small><br />
            {exp.Description}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
