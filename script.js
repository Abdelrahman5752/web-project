/* MATRIX */

const canvas = document.getElementById('matrix');

if (canvas) {
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const fontSize = 16;
    let columns = Math.floor(canvas.width / fontSize);
    let drops = Array(columns).fill(1);

    function draw() {
        ctx.fillStyle = document.body.classList.contains("dark")
            ? 'rgba(0,0,0,0.05)'
            : 'rgba(255,255,255,0.05)';

        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#00ff9d';
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

    setInterval(draw, 40);
}

/* DARK MODE */

window.onload = function () {
    let mode = localStorage.getItem("mode");
    const btn = document.getElementById("modeBtn");

    if (mode === "dark") {
        document.body.classList.add("dark");
        if (btn) btn.innerHTML = "☀️";
    } else {
        if (btn) btn.innerHTML = "🌙";
    }
};

function toggleMode() {
    document.body.classList.toggle("dark");

    const btn = document.getElementById("modeBtn");

    if (document.body.classList.contains("dark")) {
        if (btn) btn.innerHTML = "☀️";
        localStorage.setItem("mode", "dark");
    } else {
        if (btn) btn.innerHTML = "🌙";
        localStorage.setItem("mode", "light");
    }
}

/* PARTICLES */

if (typeof particlesJS !== "undefined") {
    particlesJS("particles-js", {
        particles: {
            number: { value: 80 },
            size: { value: 3 },
            move: { speed: 2 },
            line_linked: { enable: true }
        }
    });
}
