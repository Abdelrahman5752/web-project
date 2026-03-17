const canvas = document.getElementById('cyberCanvas');

// الشرط ده هو اللي بيخلي الكود يشتغل في صفحة الـ Cyber بس
if (canvas) {
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const fontSize = 16;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#00f2ff'; // اللون الأزرق اللي في الصورة
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = Math.floor(Math.random() * 2);
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }

    setInterval(draw, 50);
}
const pupils = document.querySelectorAll(".pupil")

document.addEventListener("mousemove",(e)=>{

pupils.forEach(pupil=>{

let rect = pupil.parentElement.getBoundingClientRect()

let x = e.clientX - rect.left - rect.width/2
let y = e.clientY - rect.top - rect.height/2

pupil.style.transform = `translate(${x/10}px,${y/10}px)`

})

})

function closeEyes(){

document.querySelectorAll(".eye").forEach(eye=>{
eye.classList.add("closed")
})

}

function openEyes(){

document.querySelectorAll(".eye").forEach(eye=>{
eye.classList.remove("closed")
})

}

window.onload = function(){

let mode = localStorage.getItem("mode");

const btn = document.getElementById("modeBtn");

if(mode === "dark"){

document.body.classList.add("dark");
btn.innerHTML = "☀️";

}else{

btn.innerHTML = "🌙";

}

}




function toggleMode(){

document.body.classList.toggle("dark");

const btn = document.getElementById("modeBtn");

if(document.body.classList.contains("dark")){

btn.innerHTML = "☀️";
localStorage.setItem("mode","dark");

}else{

btn.innerHTML = "🌙";
localStorage.setItem("mode","light");

}

}
window.addEventListener("load", function(){

document.getElementById("loader").style.display="none";

});
particlesJS("particles-js",{

particles:{

number:{value:80},

size:{value:3},

move:{speed:2},

line_linked:{
enable:true
}

}

});
