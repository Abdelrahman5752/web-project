// Get the matrix container
const matrix = document.getElementById("matrix");

// Characters used for the Matrix effect
const characters = "01010101010101010101010101010101010101";

// Function to create one falling character
function createCode() {
  // Create a span element
  let span = document.createElement("span");

  // Pick a random character
  span.innerText = characters[Math.floor(Math.random() * characters.length)];

  // Set initial styles
  span.style.position = "absolute";
  span.style.left = Math.random() * 100 + "vw"; // Random horizontal position
  span.style.top = "-20px"; // Start above the screen
  span.style.fontSize = (14 + Math.random() * 20) + "px"; // Random font size
  span.style.color = "#00ff00"; // Green color
  span.style.opacity = Math.random(); // Random opacity
  span.style.animation = "fall linear"; // Animation style
  span.style.animationDuration = (3 + Math.random() * 5) + "s"; // Random duration

  // Add the span to the matrix container
  matrix.appendChild(span);

  // Remove the span after it falls off the screen
  setTimeout(() => {
    span.remove();
  }, 8000);
}

// Create new characters continuously
setInterval(createCode, 80);
