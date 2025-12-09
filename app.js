// -----------------------------
// Firebase 初期化
// -----------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "各自",
    authDomain: "各自",
    databaseURL: "各自",
    projectId: "各自",
    storageBucket: "各自",
    messagingSenderId: "各自",
    appId: "各自"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// -----------------------------
// 初期データ
// -----------------------------
const state = {
    ingredients: {
        noodle_ramen_g: 3000,
        soup_ramen: 10,
        noodle_tsukemen_g: 2400,
        soup_tsukemen: 8,
        chashu: 18,
        egg: 18,
        negi: 18,
        menma: 18,
        nori: 18
    },
    queue: {
        waitingCount: 0,
        avgOrderPerPerson: 1.2
    }
};

let orderList = [];

// -----------------------------
// Firebase 保存・読み込み
// -----------------------------
function saveIngredients() {
    set(ref(db, "ingredients"), state.ingredients);
}
function saveQueue() {
    set(ref(db, "queue"), state.queue);
}
function loadAll() {
    onValue(ref(db, "ingredients"), (snapshot) => {
        const data = snapshot.val();
        if (data) state.ingredients = data;
        applyStateToAdmin();
        applyStateToOrder();
        applyStateToConfirm();
    });
    onValue(ref(db, "queue"), (snapshot) => {
        const data = snapshot.val();
        if (data) state.queue = data;
        applyStateToAdmin();
        applyStateToConfirm();
    });
}

// -----------------------------
// 提供可能数を計算
// -----------------------------
function calculateServeCounts() {
    return {
        ramen: Math.min(
            Math.floor(state.ingredients.noodle_ramen_g / 150),
            state.ingredients.soup_ramen,
            state.ingredients.chashu,
            state.ingredients.negi,
            state.ingredients.menma,
            state.ingredients.nori
        ),
        tokuseiRamen: Math.min(
            Math.floor(state.ingredients.noodle_ramen_g / 150),
            state.ingredients.soup_ramen,
            Math.floor(state.ingredients.chashu / 3),
            state.ingredients.egg,
            state.ingredients.negi,
            Math.floor(state.ingredients.menma / 2),
            Math.floor(state.ingredients.nori / 3)
        ),
        tsukemen: Math.min(
            Math.floor(state.ingredients.noodle_tsukemen_g / 300),
            state.ingredients.soup_tsukemen,
            state.ingredients.chashu,
            state.ingredients.negi,
            state.ingredients.menma,
            state.ingredients.nori
        ),
        tokuseiTsukemen: Math.min(
            Math.floor(state.ingredients.noodle_tsukemen_g / 300),
            state.ingredients.soup_tsukemen,
            Math.floor(state.ingredients.chashu / 2),
            state.ingredients.egg,
            state.ingredients.negi,
            state.ingredients.menma,
            state.ingredients.nori
        )
    };
}

// -----------------------------
// 管理画面に反映
// -----------------------------
function applyStateToAdmin() {
    const $ = (id) => document.getElementById(id);

    // 在庫反映
    $("stock-noodle").value = state.ingredients.noodle_ramen_g;
    $("stock-soup").value = state.ingredients.soup_ramen;
    $("stock-tsukemen-noodle").value = state.ingredients.noodle_tsukemen_g;
    $("stock-tsukemen-soup").value = state.ingredients.soup_tsukemen;
    $("stock-chashu").value = state.ingredients.chashu;
    $("stock-egg").value = state.ingredients.egg;
    $("stock-negi").value = state.ingredients.negi;
    $("stock-menma").value = state.ingredients.menma;
    $("stock-nori").value = state.ingredients.nori;

    // 提供可能数反映
    const serve = calculateServeCounts();
    $("serve-ramen").value = serve.ramen;
    $("serve-tokusei").value = serve.tokuseiRamen;
    $("serve-tsukemen").value = serve.tsukemen;
    $("serve-tokusei-tsukemen").value = serve.tokuseiTsukemen;

    // 並び人数
    $("queue-count").value = state.queue.waitingCount;

    // 警告メッセージ
    const msgEl = $("admin-message");
    if (state.queue.waitingCount >= serve.ramen - 4) {
        msgEl.textContent = "完売しそうです。";
    } else {
        msgEl.textContent = "";
    }
}


// -----------------------------
// 注文画面に反映（売り切れ表示）
// -----------------------------
function applyStateToOrder() {
    const serve = calculateServeCounts();

    const setSoldOut = (selector, soldOut) => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.disabled = soldOut;
        if (soldOut) {
            el.parentElement.classList.add("soldout");
        } else {
            el.parentElement.classList.remove("soldout");
        }
    };

    // メニュー
    setSoldOut('input[value="ramen"]', serve.ramen <= 0);
    setSoldOut('input[value="tokusei-ramen"]', serve.tokuseiRamen <= 0);
    setSoldOut('input[value="tsukemen"]', serve.tsukemen <= 0);
    setSoldOut('input[value="tokusei-tsukemen"]', serve.tokuseiTsukemen <= 0);

    // トッピング
    setSoldOut('input[value="chashu"]', state.ingredients.chashu <= 0);
    setSoldOut('input[value="egg"]', state.ingredients.egg <= 0);
    setSoldOut('input[value="negi"]', state.ingredients.negi <= 0);
    setSoldOut('input[value="menma"]', state.ingredients.menma <= 0);
    setSoldOut('input[value="nori"]', state.ingredients.nori <= 0);
}

// -----------------------------
// 確認画面に反映
// -----------------------------
function applyStateToConfirm() {
    const $ = (id) => document.getElementById(id);
    const serve = calculateServeCounts();
    $("confirm-queue").textContent = state.queue.waitingCount;
    $("confirm-ramen-count").textContent = serve.ramen;
}

// -----------------------------
// 注文リスト管理
// -----------------------------
function addToOrder(name, key) {
    const existing = orderList.find(item => item.key === key);
    if (existing) {
        existing.count++;
    } else {
        orderList.push({ name, key, count: 1 });
    }
    renderSummary();
}

function renderSummary() {
    const summary = document.querySelector(".summary");
    summary.innerHTML = "";
    orderList.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "summary-item";

        const nameDiv = document.createElement("div");
        nameDiv.className = "summary-name";
        nameDiv.textContent = item.name;

        const qtyDiv = document.createElement("div");
        qtyDiv.className = "qty";

        const minusBtn = document.createElement("button");
        minusBtn.textContent = "−";
        minusBtn.addEventListener("click", () => {
            item.count--;
            if (item.count <= 0) orderList.splice(index, 1);
            renderSummary();
        });

        const countSpan = document.createElement("span");
        countSpan.className = "count";
        countSpan.textContent = item.count;

        const plusBtn = document.createElement("button");
        plusBtn.textContent = "＋";
        plusBtn.addEventListener("click", () => {
            item.count++;
            renderSummary();
        });

        qtyDiv.appendChild(minusBtn);
        qtyDiv.appendChild(countSpan);
        qtyDiv.appendChild(plusBtn);

        div.appendChild(nameDiv);
        div.appendChild(qtyDiv);
        summary.appendChild(div);
    });
}

// -----------------------------
// 注文処理：在庫を減らす
// -----------------------------
function handleOrder(key) {
    switch (key) {
        case "ramen": // 普通のらーめん
            state.ingredients.noodle_ramen_g -= 150;
            state.ingredients.soup_ramen -= 1;
            state.ingredients.chashu -= 1;
            state.ingredients.negi -= 1;
            state.ingredients.menma -= 1;
            state.ingredients.nori -= 1;
            break;

        case "tokusei-ramen": // 特製らーめん
            state.ingredients.noodle_ramen_g -= 150;
            state.ingredients.soup_ramen -= 1;
            state.ingredients.chashu -= 3;
            state.ingredients.egg -= 1;
            state.ingredients.negi -= 1;
            state.ingredients.menma -= 2;
            state.ingredients.nori -= 3;
            break;

        case "tsukemen": // 普通のつけめん
            state.ingredients.noodle_tsukemen_g -= 300;
            state.ingredients.soup_tsukemen -= 1;
            state.ingredients.chashu -= 1;
            state.ingredients.negi -= 1;
            state.ingredients.menma -= 1;
            state.ingredients.nori -= 1;
            break;

        case "tokusei-tsukemen": // 特製つけめん
            state.ingredients.noodle_tsukemen_g -= 300;
            state.ingredients.soup_tsukemen -= 1;
            state.ingredients.chashu -= 2;
            state.ingredients.egg -= 1;
            state.ingredients.negi -= 1;
            state.ingredients.menma -= 1;
            state.ingredients.nori -= 1;
            break;

        default:
            if (state.ingredients[key] !== undefined) {
                state.ingredients[key]--;
            }
    }

    // 在庫がマイナスにならないよう補正
    for (const k in state.ingredients) {
        if (state.ingredients[k] < 0) state.ingredients[k] = 0;
    }
}


// -----------------------------
// 決定ボタン処理
// -----------------------------
function confirmOrder() {
    orderList.forEach(item => {
        for (let i = 0; i < item.count; i++) {
            handleOrder(item.key);
        }
    });
    saveIngredients();
    applyStateToAdmin();
    applyStateToOrder();
    applyStateToConfirm();

    // 注文リストをクリア
    orderList = [];
    renderSummary();

    // ボタンをリセット
    document.querySelectorAll('input[name="ramen"]').forEach(el => el.checked = false);
    document.querySelectorAll('input[name="topping"]').forEach(el => el.checked = false);
}

// -----------------------------
// 初期値リセット処理
// -----------------------------
function resetIngredients() {
    state.ingredients = {
        noodle_ramen_g: 6000,
        soup_ramen: 30,
        noodle_tsukemen_g: 4800,
        soup_tsukemen: 24,
        chashu: 48,
        egg: 36,
        negi: 36,
        menma: 36,
        nori: 48
    };
    state.queue.waitingCount = 0;

    saveIngredients();       // Firebaseに保存
    saveQueue();     // Firebaseに保存
    applyStateToAdmin();     // 管理画面に反映
    applyStateToOrder();     // 注文画面に反映
    applyStateToConfirm();   // 確認画面に反映
}

// HTMLから呼べるように
window.resetIngredients = resetIngredients;

// -----------------------------
// 管理画面の入力同期
// -----------------------------
function bindAdminInputs() {
    const bind = (id, key) => {
        document.getElementById(id).addEventListener("input", (e) => {
            // 入力中の値を即 state に反映
            state.ingredients[key] = Math.max(0, Number(e.target.value) || 0);


            // Firebase に保存
            saveIngredients();

            // 他画面に即反映
            applyStateToOrder();
            applyStateToConfirm();
        });
    };

    // 在庫欄
    bind("stock-noodle", "noodle_ramen_g");
    bind("stock-soup", "soup_ramen");
    bind("stock-tsukemen-noodle", "noodle_tsukemen_g");
    bind("stock-tsukemen-soup", "soup_tsukemen");
    bind("stock-chashu", "chashu");
    bind("stock-egg", "egg");
    bind("stock-negi", "negi");
    bind("stock-menma", "menma");
    bind("stock-nori", "nori");

    // 並び人数
    document.getElementById("queue-count").addEventListener("input", (e) => {
        state.queue.waitingCount = Math.max(0, Number(e.target.value) || 0);
        saveQueue();            // キューを保存
        applyStateToConfirm();  // 確認画面に即反映
    });


}
bindAdminInputs();





// -----------------------------
// ログイン処理
// -----------------------------
function handleLogin() {
    const pw = document.getElementById("password").value;
    document.getElementById("login-screen").classList.add("hidden");

    if (pw === "admin") {
        document.getElementById("admin-screen").classList.remove("hidden");
        applyStateToAdmin();
        loadAll();
    } else if (pw === "order") {
        document.getElementById("order-screen").classList.remove("hidden");
        applyStateToOrder();
        loadAll();
        // 注文選択イベントをバインド
        document.querySelectorAll('input[name="ramen"]').forEach(el => {
            el.addEventListener("change", () => {
                addToOrder(el.labels[0].textContent, el.value);
            });
        });
        document.querySelectorAll('input[name="topping"]').forEach(el => {
            el.addEventListener("change", () => {
                addToOrder(el.labels[0].textContent, el.value);
            });
        });
    } else if (pw === "user") {
        document.getElementById("confirm-screen").classList.remove("hidden");
        applyStateToConfirm();
        loadAll();
    } else {
        // パスワード不一致ならログイン画面に戻す
        document.getElementById("login-screen").classList.remove("hidden");
    }
}

// -----------------------------
// グローバル公開（HTML の onclick から呼べるように）
// -----------------------------
window.handleLogin = handleLogin;
window.confirmOrder = confirmOrder;

function scaleApp() {
    const appHeight = 932;   // 基準スマホの高さ
    const scale = window.innerHeight / appHeight;
    const wrapper = document.querySelector('.scale-wrapper');
    if (wrapper) {
        wrapper.style.transform = `scale(${scale})`;
    }
}

window.addEventListener('resize', scaleApp);
window.addEventListener('load', scaleApp);
