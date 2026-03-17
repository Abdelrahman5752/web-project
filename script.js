
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
const canvas = document.getElementById('Matrix');
const context = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nums = '0123456789';
const alphabet = katakana + latin + nums;

const fontSize = 16;
const columns = canvas.width / fontSize;

const rainDrops = [];

for (let x = 0; x < columns; x++) {
    rainDrops[x] = 1;
}

const draw = () => {
    // خلفية شبه شفافة لعمل تأثير التلاشي (Trail)
    context.fillStyle = 'rgba(0, 0, 0, 0.05)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = '#0F0'; // لون الحروف أخضر
    context.font = fontSize + 'px monospace';

    for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        context.fillText(text, i * fontSize, rainDrops[i] * fontSize);

        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            rainDrops[i] = 0;
        }
        rainDrops[i]++;
    }
};

// تحديث الشاشة كل 30 ملي ثانية
setInterval(draw, 30);

// إعادة ضبط الحجم عند تغيير حجم النافذة
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

