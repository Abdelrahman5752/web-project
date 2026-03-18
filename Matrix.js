const matrix = document.getElementById("matrix");

const characters = "01010101010101010101010101010101010101";

function createCode(){

let span = document.createElement("span");

span.innerText = characters[Math.floor(Math.random()*characters.length)];

span.style.position = "absolute";

span.style.left = Math.random()*100 + "vw";

span.style.top = "-20px";

span.style.fontSize = (14 + Math.random()*20) + "px";

span.style.color = "#00ff00";

span.style.opacity = Math.random();

span.style.animation = "fall linear";

span.style.animationDuration = (3 + Math.random()*5) + "s";

matrix.appendChild(span);

setTimeout(()=>{
span.remove();
},8000);

}

setInterval(createCode,80);
