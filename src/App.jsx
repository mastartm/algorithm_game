// src/App.jsx
import React, { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { levels } from "./levels";
import "./App.css";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const currentLevel = levels[currentLevelIndex];

  const [codeBlocks, setCodeBlocks] = useState(currentLevel.initialBlocks);

  // Yanlış çıktı alındığında, programda gerçekten gerekmeyen bir blok
  // varsa oyuncuya bunu temizlemesini öneriyoruz (ama sadece o zaman).
  const hasExtraBlocks = codeBlocks.some(
    (b) => !currentLevel.correctOrder.includes(b.id),
  );
  const [activeStep, setActiveStep] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [inboxStream, setInboxStream] = useState([...currentLevel.inputData]);
  const [outboxStream, setOutboxStream] = useState([]);
  // Robotun elinde tuttuğu değerler: TEK bir değer değil, bir YIĞIN (stack).
  // "GİRDİ AL" bloğu yığına ekler, işlem blokları yığının tepesinden alıp
  // sonucu geri yığına koyar. Bu, levels.js'teki correctOrder ile tutarlı.
  const [registers, setRegisters] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [robotPos, setRobotPos] = useState("center");
  const [isArmExtending, setIsArmExtending] = useState(false);
  const [flyingTokens, setFlyingTokens] = useState([]);
  const [operatorBadge, setOperatorBadge] = useState(null);
  // Kodu çalıştırdıkça canlı olarak dolan Python konsolu satırları
  const [consoleLines, setConsoleLines] = useState([]);
  const consoleBodyRef = useRef(null);

  // Mobilde koca bir sayfayı kaydırmak yerine iki sekme arasında geçiş:
  // "game" = bantlar + robot + konsol, "code" = kod editörü.
  const [mobileView, setMobileView] = useState("game");

  // Oyuna ilk girişte kuralları/neyin nerede olduğunu anlatan pop-up.
  // Bir kere kapatılınca localStorage'a yazılır, tekrar tekrar çıkmaz;
  // "?" butonuyla istenildiği zaman tekrar açılabilir.
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !window.localStorage.getItem("hrm_intro_seen");
    } catch {
      return true;
    }
  });

  const closeIntro = () => {
    setShowIntro(false);
    try {
      window.localStorage.setItem("hrm_intro_seen", "1");
    } catch {
      // localStorage yoksa (ör. gizli sekme) sessizce yok say
    }
  };

  useEffect(() => {
    if (consoleBodyRef.current) {
      consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
    }
  }, [consoleLines]);

  // Refs used to compute real screen coordinates for the flying-token animation
  const stageRef = useRef(null);
  const inboxTopRef = useRef(null);
  const outboxTopRef = useRef(null);
  const robotChestRef = useRef(null);

  // Bumped on every reset/new run so an in-flight async loop knows to stop
  const runIdRef = useRef(0);

  const handleLevelChange = (index) => {
    setCurrentLevelIndex(index);
    setCodeBlocks(levels[index].initialBlocks);
    resetSimulation(levels[index]);
  };

  const resetSimulation = (lvl = currentLevel, restoreBlocks = false) => {
    runIdRef.current += 1; // cancel any running loop
    if (restoreBlocks) {
      setCodeBlocks(lvl.initialBlocks);
    }
    setActiveStep(-1);
    setIsRunning(false);
    setInboxStream([...lvl.inputData]);
    setOutboxStream([]);
    setRegisters([]);
    setGameResult(null);
    setRobotPos("center");
    setIsArmExtending(false);
    setFlyingTokens([]);
    setOperatorBadge(null);
    setConsoleLines([]);
  };

  const onDragEnd = (result) => {
    if (!result.destination || isRunning) return;

    const reordered = Array.from(codeBlocks);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);

    setCodeBlocks(reordered);
    resetSimulation();
  };

  // Dokunmatik cihazlarda sürükleme her zaman güvenilir çalışmadığı için
  // yukarı/aşağı butonlarıyla da aynı sıralama değişikliğini yapabiliyoruz.
  const moveBlock = (index, direction) => {
    if (isRunning) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= codeBlocks.length) return;

    const reordered = Array.from(codeBlocks);
    const [removed] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, removed);

    setCodeBlocks(reordered);
    resetSimulation();
  };

  // Gereksiz/tuzak bloğu programdan tamamen çıkarır (gerçek "çöpe atma").
  // SIFIRLA'ya basılana kadar bu silme kalıcıdır.
  const deleteBlock = (index) => {
    if (isRunning) return;
    const updated = codeBlocks.filter((_, i) => i !== index);
    setCodeBlocks(updated);
    resetSimulation();
  };

  // Animate a value flying from one DOMRect to another, relative to the stage.
  const flyToken = (value, fromRect, toRect, colorClass = "flying-yellow") => {
    return new Promise((resolve) => {
      if (!fromRect || !toRect || !stageRef.current) {
        resolve();
        return;
      }
      const stageRect = stageRef.current.getBoundingClientRect();
      const id = `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const start = {
        left: fromRect.left - stageRect.left + fromRect.width / 2 - 22,
        top: fromRect.top - stageRect.top + fromRect.height / 2 - 22,
      };
      const end = {
        left: toRect.left - stageRect.left + toRect.width / 2 - 22,
        top: toRect.top - stageRect.top + toRect.height / 2 - 22,
      };

      setFlyingTokens((prev) => [
        ...prev,
        { id, value, colorClass, style: start },
      ]);

      // Wait a frame so the browser registers the start position before we
      // move it, otherwise the CSS transition won't animate.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlyingTokens((prev) =>
            prev.map((t) => (t.id === id ? { ...t, style: end } : t)),
          );
        });
      });

      setTimeout(() => {
        setFlyingTokens((prev) => prev.filter((t) => t.id !== id));
        resolve();
      }, 480);
    });
  };

  const flashOperator = async (symbol) => {
    setOperatorBadge(symbol);
    await sleep(450);
    setOperatorBadge(null);
  };

  // Robot walks to the inbox belt, grabs the next value, carries it back.
  // Returns the grabbed value (or null if the belt was empty).
  const grabFromInbox = async (inbox, myRunId) => {
    if (inbox.length === 0) return { value: null, inbox };
    setRobotPos("inbox");
    await sleep(350);
    if (runIdRef.current !== myRunId) return { value: null, inbox };

    setIsArmExtending(true);
    await sleep(200);

    const fromRect = inboxTopRef.current?.getBoundingClientRect();
    const value = inbox[0];
    const nextInbox = inbox.slice(1);
    setInboxStream([...nextInbox]); // remove immediately so it doesn't "ghost"

    const toRect = robotChestRef.current?.getBoundingClientRect();
    await flyToken(value, fromRect, toRect, "flying-yellow");

    setIsArmExtending(false);
    return { value, inbox: nextInbox };
  };

  // Robot carries the given value from its chest to the outbox belt.
  const dropToOutboxValue = async (value, outbox, myRunId) => {
    setRobotPos("outbox");
    await sleep(350);
    if (runIdRef.current !== myRunId) return outbox;

    setIsArmExtending(true);
    await sleep(200);

    const fromRect = robotChestRef.current?.getBoundingClientRect();
    const toRect = outboxTopRef.current?.getBoundingClientRect();
    await flyToken(value, fromRect, toRect, "flying-green");

    const nextOutbox = [...outbox, value];
    setOutboxStream(nextOutbox);
    setIsArmExtending(false);
    return nextOutbox;
  };

  const runSimulation = async () => {
    resetSimulation();
    await sleep(60); // let the reset paint before we start
    const myRunId = runIdRef.current + 1;
    runIdRef.current = myRunId;
    setIsRunning(true);

    let inbox = [...currentLevel.inputData];
    let outbox = [];
    let regs = []; // local mirror of the register stack
    let varStack = []; // her registera karşılık gelen "değişken adı" (v1, v2, ...)
    let varCounter = 0;
    let failed = false;

    const pushRegs = (next) => {
      regs = next;
      setRegisters([...regs]);
    };

    const newVarName = () => {
      varCounter += 1;
      return `v${varCounter}`;
    };

    const logLine = (text, type = "code") => {
      setConsoleLines((prev) => [...prev, { text, type }]);
    };

    logLine("def cozum():");

    for (let i = 0; i < codeBlocks.length; i++) {
      if (runIdRef.current !== myRunId) return;
      setActiveStep(i);
      const block = codeBlocks[i];
      const id = block.id;

      if (id.startsWith("inbox")) {
        const res = await grabFromInbox(inbox, myRunId);
        if (runIdRef.current !== myRunId) return;
        inbox = res.inbox;
        if (res.value !== null) {
          pushRegs([...regs, res.value]);
          const vn = newVarName();
          varStack.push(vn);
          logLine(`    ${vn} = inbox()`.padEnd(24) + `# ${vn} = ${res.value}`);
        }
        setRobotPos("center");
      } else if (id.startsWith("outbox")) {
        if (regs.length > 0) {
          const value = regs[regs.length - 1];
          pushRegs(regs.slice(0, -1));
          const vn = varStack.pop();
          outbox = await dropToOutboxValue(value, outbox, myRunId);
          if (runIdRef.current !== myRunId) return;
          logLine(`    outbox(${vn})`.padEnd(24) + `# çıktı: ${value}`);
        }
        setRobotPos("center");
      } else if (id.startsWith("add")) {
        if (regs.length >= 2) {
          const b = regs[regs.length - 1];
          const a = regs[regs.length - 2];
          pushRegs(regs.slice(0, -2));
          await flashOperator("+");
          const result = a + b;
          pushRegs([...regs, result]);
          const vb = varStack.pop();
          const va = varStack.pop();
          const vn = newVarName();
          varStack.push(vn);
          logLine(
            `    ${vn} = ${va} + ${vb}`.padEnd(24) + `# ${vn} = ${result}`,
          );
        }
      } else if (id.startsWith("sub")) {
        // Etiket: ÇIKAR (B - A) -> A önce girilen (alttaki), B sonra girilen (üstteki)
        if (regs.length >= 2) {
          const b = regs[regs.length - 1];
          const a = regs[regs.length - 2];
          pushRegs(regs.slice(0, -2));
          await flashOperator("−");
          const result = b - a;
          pushRegs([...regs, result]);
          const vb = varStack.pop();
          const va = varStack.pop();
          const vn = newVarName();
          varStack.push(vn);
          logLine(
            `    ${vn} = ${vb} - ${va}`.padEnd(24) + `# ${vn} = ${result}`,
          );
        }
      } else if (id.startsWith("pick_max")) {
        if (regs.length >= 2) {
          const b = regs[regs.length - 1];
          const a = regs[regs.length - 2];
          pushRegs(regs.slice(0, -2));
          await flashOperator("MAX");
          const result = Math.max(a, b);
          pushRegs([...regs, result]);
          const vb = varStack.pop();
          const va = varStack.pop();
          const vn = newVarName();
          varStack.push(vn);
          logLine(
            `    ${vn} = max(${va}, ${vb})`.padEnd(24) + `# ${vn} = ${result}`,
          );
        }
      } else if (id.startsWith("sum3")) {
        if (regs.length >= 3) {
          const c = regs[regs.length - 1];
          const b = regs[regs.length - 2];
          const a = regs[regs.length - 3];
          pushRegs(regs.slice(0, -3));
          await flashOperator("+");
          const result = a + b + c;
          pushRegs([...regs, result]);
          const vc = varStack.pop();
          const vb = varStack.pop();
          const va = varStack.pop();
          const vn = newVarName();
          varStack.push(vn);
          logLine(
            `    ${vn} = ${va} + ${vb} + ${vc}`.padEnd(24) +
              `# ${vn} = ${result}`,
          );
        }
      } else if (id.startsWith("mult2")) {
        if (regs.length >= 1) {
          const a = regs[regs.length - 1];
          pushRegs(regs.slice(0, -1));
          await flashOperator("×2");
          const result = a * 2;
          pushRegs([...regs, result]);
          const va = varStack.pop();
          const vn = newVarName();
          varStack.push(vn);
          logLine(`    ${vn} = ${va} * 2`.padEnd(24) + `# ${vn} = ${result}`);
        }
      } else if (id.startsWith("negate")) {
        if (regs.length >= 1) {
          const a = regs[regs.length - 1];
          const va = varStack[varStack.length - 1];
          if (a < 0) {
            pushRegs(regs.slice(0, -1));
            await flashOperator("ABS");
            const result = Math.abs(a);
            pushRegs([...regs, result]);
            varStack.pop();
            const vn = newVarName();
            varStack.push(vn);
            logLine(
              `    ${vn} = abs(${va})`.padEnd(24) + `# ${vn} = ${result}`,
            );
          } else {
            logLine(`    # ${va} zaten pozitif`.padEnd(24) + `(${va} = ${a})`);
          }
        }
      } else if (id.startsWith("square")) {
        if (regs.length >= 1) {
          const a = regs[regs.length - 1];
          pushRegs(regs.slice(0, -1));
          await flashOperator("x²");
          const result = a * a;
          pushRegs([...regs, result]);
          const va = varStack.pop();
          const vn = newVarName();
          varStack.push(vn);
          logLine(`    ${vn} = ${va} ** 2`.padEnd(24) + `# ${vn} = ${result}`);
        }
      } else if (id.startsWith("div3")) {
        if (regs.length >= 1) {
          const a = regs[regs.length - 1];
          pushRegs(regs.slice(0, -1));
          await flashOperator("÷3");
          const result = Math.floor(a / 3);
          pushRegs([...regs, result]);
          const va = varStack.pop();
          const vn = newVarName();
          varStack.push(vn);
          logLine(`    ${vn} = ${va} // 3`.padEnd(24) + `# ${vn} = ${result}`);
        }
      } else if (id.startsWith("check_zero")) {
        const top = regs[regs.length - 1];
        const vtop = varStack[varStack.length - 1];
        if (top === 0) {
          logLine(
            `    if ${vtop} == 0: return`.padEnd(24) +
              `# DURDU (${vtop}=${top})`,
            "error",
          );
          failed = true;
          break;
        } else {
          logLine(
            `    if ${vtop} == 0: return`.padEnd(24) +
              `# devam (${vtop}=${top})`,
          );
        }
      } else if (id.startsWith("check_even")) {
        const top = regs[regs.length - 1];
        const vtop = varStack[varStack.length - 1];
        if (top !== undefined && top % 2 !== 0) {
          logLine(
            `    if ${vtop} % 2 != 0: return`.padEnd(24) +
              `# DURDU (${vtop}=${top})`,
            "error",
          );
          failed = true;
          break;
        } else {
          logLine(
            `    if ${vtop} % 2 != 0: return`.padEnd(24) +
              `# devam (${vtop}=${top})`,
          );
        }
      }

      await sleep(280); // pacing between steps
    }

    if (runIdRef.current !== myRunId) return;

    setActiveStep(codeBlocks.length);
    setRobotPos("center");
    await sleep(400);
    if (runIdRef.current !== myRunId) return;

    setIsRunning(false);
    if (failed) {
      setGameResult("wrong");
      logLine("Traceback (most recent call last):", "error");
      logLine(
        `  File "cozum.py", line ${codeBlocks.length}, in cozum`,
        "error",
      );
      logLine(
        "RuntimeError: program bir kuralı ihlal ettiği için durduruldu",
        "error",
      );
    } else {
      const isSuccess =
        JSON.stringify(outbox) === JSON.stringify(currentLevel.expectedOutput);
      setGameResult(isSuccess ? "correct" : "wrong");
      if (isSuccess) {
        logLine("# Program tamamlandı ✅");
      } else {
        logLine("Traceback (most recent call last):", "error");
        logLine(
          `  File "cozum.py", line ${codeBlocks.length}, in cozum`,
          "error",
        );
        logLine(
          `AssertionError: beklenen ${JSON.stringify(
            currentLevel.expectedOutput,
          )} fakat üretilen ${JSON.stringify(outbox)}`,
          "error",
        );
      }
    }
  };

  return (
    <div className="game-wrapper">
      {showIntro && (
        <div className="intro-overlay">
          <div className="intro-modal">
            <h2>🤖 Nasıl Oynanır?</h2>
            <ul className="intro-list">
              <li>
                <strong>INBOX / OUTBOX bantları:</strong> Sayılar soldan (INBOX)
                gelir, robotun işleyip sağa (OUTBOX) teslim etmesi gerekir.
              </li>
              <li>
                <strong>Robot:</strong> Elinde tuttuğu sayılarla komutları
                sırayla çalıştırır.
              </li>
              <li>
                <strong>KOD EDİTÖRÜ:</strong> Masaüstünde soldaki ⠿ simgesinden
                tutup sürükle, mobilde ▲▼ kullan. Gereksiz bir blok varsa 🗑 ile
                çöpe at.
              </li>
              <li>
                <strong>▶ KODU ÇALIŞTIR:</strong> Programı çalıştırır, sonucu
                OUTBOX'ta görürsün.
              </li>
              <li>
                <strong>🖥 Konsol:</strong> Kodunun Python karşılığını gerçek
                değerlerle canlı gösterir.
              </li>
              <li>
                <strong>📱 Mobilde:</strong> "🎮 Oyun" ve "💻 Kod" sekmeleri
                arasında geçiş yaparak ekranları değiştir.
              </li>
            </ul>
            <button className="intro-close-btn" onClick={closeIntro}>
              Anladım, Başla! 🚀
            </button>
          </div>
        </div>
      )}

      <nav className="level-bar-wrapper">
        <div className="level-bar">
          {levels.map((lvl, idx) => (
            <button
              key={lvl.id}
              className={`btn-lvl ${idx === currentLevelIndex ? "active" : ""}`}
              onClick={() => handleLevelChange(idx)}
              disabled={isRunning}
            >
              Lvl {lvl.id}
            </button>
          ))}
        </div>
        <nav className="level-bar-wrapper">
          <div className="level-bar">{/* ...mevcut Lvl butonları... */}</div>
          <button
            className="help-fab"
            onClick={() => setShowIntro(true)}
            aria-label="Yardım"
            title="Nasıl oynanır?"
          >
            ?
          </button>
        </nav>
      </nav>

      {/* Sadece mobilde görünür: oyun sahnesi / kod editörü sekmeleri */}
      <div className="mobile-tabs">
        <button
          type="button"
          className={`mobile-tab-btn ${mobileView === "game" ? "active" : ""}`}
          onClick={() => setMobileView("game")}
        >
          🎮 Oyun
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${mobileView === "code" ? "active" : ""}`}
          onClick={() => setMobileView("code")}
        >
          💻 Kod {isRunning && <span className="tab-run-dot" />}
        </button>
      </div>

      <div className="main-stage" ref={stageRef}>
        {/* Flying tokens layer sits on top of everything, ignores clicks */}
        <div className="flying-tokens-layer">
          {flyingTokens.map((t) => (
            <div
              key={t.id}
              className={`flying-token ${t.colorClass}`}
              style={{ left: t.style.left, top: t.style.top }}
            >
              {t.value}
            </div>
          ))}
        </div>

        {/* SOL KOLON: INBOX BANDI */}
        <div
          className={`column conveyor-col inbox-col ${mobileView !== "game" ? "mobile-hidden" : ""}`}
        >
          <div className="conveyor-box">
            <h3>INBOX BANDI</h3>
            <div className="conveyor-belt">
              <div className="belt-track"></div>
              <div className="stream">
                {inboxStream.map((val, i) => (
                  <div
                    key={i}
                    className="stream-item input-item"
                    ref={i === 0 ? inboxTopRef : null}
                  >
                    {val}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ORTA KOLON: ROBOT SAHNESİ */}
        <div
          className={`column robot-col ${mobileView !== "game" ? "mobile-hidden" : ""}`}
        >
          <div className="level-info">
            <h2>{currentLevel.title}</h2>
            <p>{currentLevel.goal}</p>
          </div>

          <div className="robot-arena">
            <div
              className={`robot pos-${robotPos} ${isRunning ? "walking" : ""}`}
            >
              <div className="robot-antenna"></div>
              <div className="robot-head">
                <div className="robot-eye left"></div>
                <div className="robot-eye right"></div>
              </div>
              <div className="robot-body">
                <div
                  className={`robot-arm left ${isArmExtending ? "extend" : ""}`}
                ></div>
                <div className="robot-chest" ref={robotChestRef}>
                  {operatorBadge && (
                    <span className="operator-badge">{operatorBadge}</span>
                  )}
                  {registers.length > 0 ? (
                    <div className="register-stack">
                      {registers.map((v, i) => (
                        <span key={i} className="carried-box">
                          {v}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="empty-slot">BOŞ</span>
                  )}
                </div>
                <div
                  className={`robot-arm right ${isArmExtending ? "extend" : ""}`}
                ></div>
              </div>
              <div className="robot-legs">
                <div className="leg left"></div>
                <div className="leg right"></div>
              </div>
            </div>
          </div>

          <div className="stage-controls">
            <button
              className="btn-action run"
              onClick={runSimulation}
              disabled={isRunning}
            >
              ▶ KODU ÇALIŞTIR
            </button>
            <button
              className="btn-action reset"
              onClick={() => resetSimulation(currentLevel, true)}
              disabled={isRunning}
            >
              ↺ SIFIRLA
            </button>
          </div>

          {gameResult === "correct" && (
            <div className="alert success">
              🎉 TEBRİKLER! Görev Tamamlandı.
              {currentLevelIndex < levels.length - 1 && (
                <button
                  className="btn-next-level"
                  onClick={() => handleLevelChange(currentLevelIndex + 1)}
                >
                  Sonraki Seviye ➔
                </button>
              )}
            </div>
          )}
          {gameResult === "wrong" && (
            <div className="alert error">
              ❌ HATA! Yanlış çıktı elde edildi.
              {hasExtraBlocks && (
                <div className="hint-text">
                  💡 İpucu: Listende gerekmeyen bir komut olabilir.
                  Kullanmadığın bir tanesini 🗑 ile temizlemeyi dene.
                </div>
              )}
            </div>
          )}

          <div className="console-box">
            <div className="console-header">🖥 KONSOL (Python)</div>
            <div className="console-body" ref={consoleBodyRef}>
              {consoleLines.length === 0 ? (
                <div className="console-placeholder">
                  # Kodu çalıştırınca üretilen Python karşılığı burada görünecek
                </div>
              ) : (
                consoleLines.map((line, i) => (
                  <div
                    key={i}
                    className={`console-line ${line.type === "error" ? "console-error" : ""}`}
                  >
                    {line.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SAĞ KOLON: OUTBOX BANDI */}
        <div
          className={`column conveyor-col outbox-col ${mobileView !== "game" ? "mobile-hidden" : ""}`}
        >
          <div className="conveyor-box">
            <h3>OUTBOX BANDI</h3>
            <div className="conveyor-belt">
              <div className="belt-track"></div>
              <div className="stream">
                {outboxStream.map((val, i) => (
                  <div
                    key={i}
                    className="stream-item output-item"
                    ref={i === outboxStream.length - 1 ? outboxTopRef : null}
                  >
                    {val}
                  </div>
                ))}
                {/* Anchor for an empty outbox so the first drop has a target */}
                {outboxStream.length === 0 && (
                  <div className="stream-anchor" ref={outboxTopRef}></div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ DİKEY KOD EDİTÖRÜ */}
        <div
          className={`column editor-col ${mobileView !== "code" ? "mobile-hidden" : ""}`}
        >
          <h3>KOD EDİTÖRÜ</h3>
          <p className="sub-text">
            Sırayı değiştirmek için sürükle ya da ▲▼ kullan. Gereksiz bir blok
            varsa 🗑 ile çöpe at.
          </p>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="vertical-code-editor" direction="vertical">
              {(provided) => (
                <div
                  className="vertical-editor"
                  key={currentLevelIndex}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {codeBlocks.map((block, index) => (
                    <Draggable
                      key={block.id}
                      draggableId={block.id}
                      index={index}
                      isDragDisabled={isRunning}
                    >
                      {(provided, snapshot) => (
                        <div
                          className={`editor-line ${snapshot.isDragging ? "dragging" : ""} ${activeStep === index ? "active-executing" : ""}`}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            ...provided.draggableProps.style,
                            animationDelay: `${index * 70}ms`,
                          }}
                        >
                          <span
                            className="drag-handle"
                            {...provided.dragHandleProps}
                            aria-label="Sürüklemek için tut"
                          >
                            ⠿
                          </span>
                          <span className="line-num">{index + 1}</span>
                          <span className={`cmd-tag block-${block.type}`}>
                            {block.function}
                          </span>
                          <div className="reorder-buttons">
                            <button
                              type="button"
                              className="btn-reorder"
                              disabled={isRunning || index === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveBlock(index, -1);
                              }}
                              aria-label="Yukarı taşı"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className="btn-reorder"
                              disabled={
                                isRunning || index === codeBlocks.length - 1
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                moveBlock(index, 1);
                              }}
                              aria-label="Aşağı taşı"
                            >
                              ▼
                            </button>
                          </div>
                          <button
                            type="button"
                            className="btn-trash"
                            disabled={isRunning}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBlock(index);
                            }}
                            aria-label="Bu bloğu çöpe at"
                            title="Gereksizse çöpe at"
                          >
                            🗑
                          </button>
                          {activeStep === index && (
                            <span className="exec-pointer">👈</span>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="task-reminder">
            🎯 <strong>{currentLevel.title}</strong>
            <p>{currentLevel.goal}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
