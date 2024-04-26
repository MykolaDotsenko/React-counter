import React, { useEffect, useState } from "react";

export const CounterApp = () => {
  const [counter, setCounter] = useState(() => {
    const savedCounter = JSON.parse(window.localStorage.getItem("counter"));
if(savedCounter) {
    return savedCounter
}


    return 0
  });

  useEffect(() => {
    window.localStorage.setItem("counter", counter);
  }, [counter]);

  const handleDecrease = () => {
    if (counter === 0) {
      return;
    }
    setCounter((prev) => prev - 1);
  };

  const handleIncrease = () => {
    setCounter((prev) => prev + 1);
  };

  return (
    <div>
      <button onClick={handleDecrease}>-</button>
      <h1>{counter}</h1>
      <button onClick={handleIncrease}>+</button>
    </div>
  );
};
