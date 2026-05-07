/* --- SÉLECTEURS --- */
const modeBtn = document.getElementById('mode-btn');
const saveBtn = document.getElementById('save-btn');
const runBtn = document.getElementById('run-btn');
const openBtn = document.getElementById('open-btn');
const fileInput = document.getElementById('file-input');
const newFileBtn = document.getElementById('new-file-btn');
const tabsContainer = document.getElementById('tabs-container');
const editorContainer = document.getElementById('editor-container');
const codeTextarea = document.getElementById('code-editor');
let editor = null;
const statusMode = document.getElementById('status-mode');
const statusPosition = document.getElementById('status-position');
const guideBtn = document.getElementById('guide-btn');
const guideOverlay = document.getElementById('guide-overlay');
const guideTitle = document.getElementById('guide-title');
const guideDescription = document.getElementById('guide-description');
const guideCodeSnippet = document.getElementById('guide-code-snippet');
const guideCopyCodeBtn = document.getElementById('guide-copy-code');
const guidePrevBtn = document.getElementById('guide-prev');
const guideNextBtn = document.getElementById('guide-next');
const guideCloseBtn = document.getElementById('guide-close');
const evalInputField = document.getElementById('eval-input');
const consoleEvalBtn = document.getElementById('eval-btn');
let guideIndex = 0;
let guideCurrentTarget = null;
let guideCurrentTargetListener = null;

const guideSteps = [
    {
        title: 'Bienvenue dans utoPy',
        description: 'Ce guide interactif vous accompagne pas à pas. Commencez par cliquer sur le bouton Nouveau fichier.',
        highlight: newFileBtn,
        waitFor: newFileBtn,
        autoAdvance: true
    },
    {
        title: 'Écrivez un programme simple',
        description: 'Collez ce court code dans l’éditeur. Il affichera un message quand vous l’exécuterez.',
        snippet: 'def saluer():\n    print("Bonjour, utoPy !")\n\nsaluer()',
        copyLabel: 'Copier le code',
        highlight: editorContainer
    },
    {
        title: 'Exécutez le code',
        description: 'Cliquez sur le bouton Exécuter pour lancer le programme depuis l’éditeur.',
        highlight: runBtn,
        waitFor: runBtn,
        autoAdvance: true
    },
    {
        title: 'Testez la console',
        description: 'Copiez cette commande dans la console puis appuyez sur Eval pour voir l’output.',
        snippet: 'print("Bonjour depuis la console !")',
        copyLabel: 'Copier la commande',
        prefillConsole: 'print("Bonjour depuis la console !")',
        highlight: consoleEvalBtn,
        waitFor: consoleEvalBtn,
        autoAdvance: true
    },
    {
        title: 'Terminé',
        description: 'Bravo ! Vous avez suivi le guide et vu du code s’exécuter. Fermez le guide ou recommencez si vous voulez explorer encore.',
        highlight: runBtn
    }
];

function clearGuideHighlight() {
    document.querySelectorAll('.guide-highlight').forEach(el => el.classList.remove('guide-highlight', 'guide-pulse'));
    if (guideCurrentTarget && guideCurrentTargetListener) {
        guideCurrentTarget.removeEventListener('click', guideCurrentTargetListener);
        guideCurrentTarget = null;
        guideCurrentTargetListener = null;
    }
}

function setGuideWaitTarget(target, autoAdvance) {
    if (!target) return;

    guideNextBtn.disabled = true;
    guideCurrentTarget = target;
    guideCurrentTargetListener = () => {
        guideNextBtn.disabled = false;
        guideCurrentTarget.removeEventListener('click', guideCurrentTargetListener);
        guideCurrentTargetListener = null;
        logToConsole('Très bien ! Continuez le guide.', 'success');
        if (autoAdvance) {
            setTimeout(nextGuideStep, 300);
        }
    };
    target.addEventListener('click', guideCurrentTargetListener, { once: true });
}

function showGuideStep() {
    const step = guideSteps[guideIndex];

    guideTitle.innerText = step.title;
    guideDescription.innerText = step.description;

    if (step.snippet) {
        guideCodeSnippet.style.display = 'block';
        guideCodeSnippet.textContent = step.snippet;
        guideCopyCodeBtn.style.display = 'inline-flex';
        guideCopyCodeBtn.innerText = step.copyLabel || 'Copier le code';
        guideCopyCodeBtn.dataset.clipboard = step.snippet;
    } else {
        guideCodeSnippet.style.display = 'none';
        guideCodeSnippet.textContent = '';
        guideCopyCodeBtn.style.display = 'none';
        guideCopyCodeBtn.dataset.clipboard = '';
    }

    guidePrevBtn.disabled = guideIndex === 0;
    guideNextBtn.innerText = guideIndex === guideSteps.length - 1 ? 'Terminer' : 'Suivant';
    guideNextBtn.disabled = !!step.waitFor;

    clearGuideHighlight();
    if (step.highlight) {
        step.highlight.classList.add('guide-highlight', 'guide-pulse');
    }

    if (step.prefillConsole && evalInputField) {
        evalInputField.value = step.prefillConsole;
        evalInputField.focus();
    }

    if (step.waitFor) {
        setGuideWaitTarget(step.waitFor);
    }
}

function openGuide() {
    guideOverlay.classList.add('active');
    guideIndex = 0;
    showGuideStep();
}

function closeGuide() {
    guideOverlay.classList.remove('active');
    clearGuideHighlight();
}

function nextGuideStep() {
    if (guideIndex >= guideSteps.length - 1) {
        closeGuide();
        return;
    }
    guideIndex += 1;
    showGuideStep();
}

function prevGuideStep() {
    if (guideIndex <= 0) return;
    guideIndex -= 1;
    showGuideStep();
}

function copyGuideSnippet() {
    const text = guideCopyCodeBtn.dataset.clipboard;
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            logToConsole('Le code a été copié dans le presse-papiers.', 'success');
        }).catch(() => {
            logToConsole('Impossible de copier automatiquement. Utilisez Ctrl+C.', 'error');
        });
    } else {
        logToConsole('Copie non supportée par ce navigateur.', 'error');
    }
}

if (guideBtn) guideBtn.addEventListener('click', openGuide);
if (guidePrevBtn) guidePrevBtn.addEventListener('click', prevGuideStep);
if (guideNextBtn) guideNextBtn.addEventListener('click', nextGuideStep);
if (guideCloseBtn) guideCloseBtn.addEventListener('click', closeGuide);
if (guideCopyCodeBtn) guideCopyCodeBtn.addEventListener('click', copyGuideSnippet);

/* --- ÉTAT DE L'APPLICATION --- */
window.isStudentMode = true;
window.isPyodideReady = false;
window.pyodide = null;
let isRunning = false;
let fileContent = {};
let savedFileContent = {}; 
let fileHandles = {};
let pythonWorker = null;
let isWorkerReady = false;

// Fonction pour charger Pyodide au démarrage
async function initPyodide() {
    logToConsole("Chargement du moteur Python...", "info");
    try {
        window.pyodide = await loadPyodide({
            stdout: (text) => logToConsole(text, "info"),
            stderr: (text) => logToConsole(text, "error")
        });

        const response = await fetch("mrpython.zip");
        const buffer = await response.arrayBuffer();
        window.pyodide.unpackArchive(buffer, "zip");

        window.pyodide.runPython(`
import sys
import os
if os.path.exists('mrpython'):
    sys.path.append(os.path.abspath('mrpython'))
sys.path.append('.')
        `.trim());

        window.isPyodideReady = true;
        logToConsole("utoPy est prêt et chargé !", "success");
    } catch (err) {
        logToConsole("Erreur d'initialisation : " + err, "error");
    }
}

initPyodide();

function initWorker() {
    pythonWorker = new Worker('js/pyodide-worker.js');
    
    pythonWorker.onmessage = (e) => {
        const { type, content } = e.data;
        
        if (type === 'ready') {
            isWorkerReady = true;
            logToConsole("Moteur Python prêt (Worker).", "success");
        } 
        else if (type === 'stdout') logToConsole(content, "info");
        else if (type === 'stderr') logToConsole(content, "error");
        else if (type === 'result') {
            handlePythonResult(content);
            finishRun(); // On ne tue plus le worker ici !
        }
        else if (type === 'error') {
            logToConsole("Erreur : " + content, "error");
            finishRun();
        }
    };
}

initWorker();

/* --- FONCTIONS --- */

function initCodeMirror() {
    if (typeof CodeMirror === 'undefined' || !codeTextarea) return;

    editor = CodeMirror.fromTextArea(codeTextarea, {
        mode: 'python',
        theme: 'material',
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        autoCloseBrackets: true,
        matchBrackets: true,
        extraKeys: {
            Tab: (cm) => {
                if (cm.somethingSelected()) cm.indentSelection('add');
                else cm.replaceSelection(' '.repeat(cm.getOption('indentUnit')), 'end');
            },
            'Shift-Tab': 'indentLess',
            Enter: 'newlineAndIndent'
        }
    });

    editor.setSize('100%', '100%');

    editor.on('change', () => {
        const activeTab = document.querySelector('.tab.active');
        if (!activeTab) return;
        const titleSpan = activeTab.querySelector('.tab-title');
        const fileName = titleSpan.innerText.replace('*', '');
        fileContent[fileName] = editor.getValue();
        updateTabStatus(activeTab, fileName);
    });

    editor.on('cursorActivity', updateCursorInfo);
}

window.addEventListener('DOMContentLoaded', initCodeMirror);

function updateTabStatus(tabElement, fileName) {
    const titleSpan = tabElement.querySelector('.tab-title');
    const isDirty = fileContent[fileName] !== savedFileContent[fileName];
    titleSpan.innerText = isDirty ? fileName + '*' : fileName;
}

function activateTab(tabElement) {
    if (!tabElement) return;
    const titleSpan = tabElement.querySelector('.tab-title');
    const fileName = titleSpan.innerText.replace('*', '');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElement.classList.add('active');
    editorContainer.style.display = 'flex';
    if (editor) {
        editor.setValue(fileContent[fileName] || '');
        editor.refresh();
        editor.focus();
    } else {
        codeTextarea.value = fileContent[fileName] || '';
    }
    updateTabStatus(tabElement, fileName);
    updateCursorInfo();
    tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function updateCursorInfo() {
    if (!editor) return;
    const cursor = editor.getCursor();
    statusPosition.innerText = `Li ${cursor.line + 1}, Col ${cursor.ch + 1}`;
}

function createNewTab(fileName) {
    const newTab = document.createElement('div');
    newTab.className = 'tab'; 
    newTab.innerHTML = `<span class="tab-title">${fileName}</span><span class="close-tab">×</span>`;
    newTab.addEventListener('click', () => activateTab(newTab));
    newTab.querySelector('.close-tab').addEventListener('click', (e) => {
        e.stopPropagation();
        if (newTab.querySelector('.tab-title').innerText.endsWith('*')) {
            if (!confirm("Fichier non sauvegardé. Fermer quand même ?")) return;
        }
        delete fileContent[fileName];
        delete savedFileContent[fileName];
        delete fileHandles[fileName];
        newTab.remove();
        const remaining = document.querySelectorAll('.tab');
        if (remaining.length > 0) activateTab(remaining[remaining.length - 1]);
        else editorContainer.style.display = 'none';
    });
    tabsContainer.appendChild(newTab);
    activateTab(newTab);
}

async function saveFile() {
    const activeTab = document.querySelector('.tab.active');
    if (!activeTab) return;
    
    const titleSpan = activeTab.querySelector('.tab-title');
    const fileName = titleSpan.innerText.replace('*', '');
    const content = editor ? editor.getValue() : codeTextarea.value;

    // ESSAI MÉTHODE 1 : Sauvegarde directe
    if (window.showSaveFilePicker) {
        try {
            let handle = fileHandles[fileName];
            if (!handle) {
                handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{ description: 'Python Files', accept: { 'text/x-python': ['.py'] } }],
                });
                fileHandles[fileName] = handle;
            }
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            
            confirmSave(activeTab, fileName, content);
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn("Méthode moderne bloquée, passage au téléchargement.");
        }
    }

    // MÉTHODE 2 : Téléchargement
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName; 
    link.click();
    URL.revokeObjectURL(link.href);
    
    confirmSave(activeTab, fileName, content);
}

function confirmSave(tabElement, fileName, content) {
    savedFileContent[fileName] = content;
    updateTabStatus(tabElement, fileName);
}

function handleOpenFile(name, content, handle) {
    if (!fileContent[name]) {
        fileContent[name] = content;
        savedFileContent[name] = content;
        if (handle) fileHandles[name] = handle;
        createNewTab(name);
    } else {
        const tabs = Array.from(document.querySelectorAll('.tab-title'));
        const existingTab = tabs.find(t => t.innerText.replace('*','') === name);
        if (existingTab) activateTab(existingTab.parentElement);
    }
}

function finishRun() {
    isRunning = false;
    runBtn.src = "images/run_icon2.gif";
}

function stopPythonManual() {
    logToConsole("Arrêt forcé du processus...", "error");
    
    pythonWorker.terminate();
    isWorkerReady = false;
    
    initWorker();
    
    finishRun();
    logToConsole("Processus arrêté. Redémarrage du moteur...", "info");
}

tabsContainer.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
        e.preventDefault();
        
        tabsContainer.scrollLeft += e.deltaY;
    }
}, { passive: false });


function handlePythonResult(response) {
    if (response.errors_list && response.errors_list.length > 0) {
        response.errors_list.forEach(err => logToConsole(err, "error"));
    }

    if (response.feedback && response.feedback.length > 0) {
        response.feedback.forEach(msg => logToConsole(msg, "success"));
    }

    if (response.output) {
        logToConsole(response.output, "info");
    }

    if (window.isStudentMode && response.success) {
        logToConsole(`==> Les ${response.nb_tests} tests sont passés avec succès`, "success");
    }
}

/* --- ÉVÉNEMENTS --- */

newFileBtn.addEventListener('click', () => {
    let name = prompt("Nom du fichier :");
    if (name && name.trim() !== "") {
        name = name.trim();
        if (!name.toLowerCase().endsWith(".py")) name += ".py";
        if (!fileContent[name]) {
            fileContent[name] = ""; 
            savedFileContent[name] = "";
            createNewTab(name);
        } else {
            alert("Ce fichier est déjà ouvert !");
        }
    }
});

openBtn.addEventListener('click', async () => {
    // MÉTHODE 1 : Chrome, Edge
    if (window.showOpenFilePicker) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'Python Files', accept: { 'text/x-python': ['.py'] } }],
                multiple: false
            });
            const file = await handle.getFile();
            const content = await file.text();
            handleOpenFile(file.name, content, handle);
            return;
        } catch (err) {
            if (err.name !== 'AbortError') console.error(err);
        }
    }
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        handleOpenFile(file.name, event.target.result, null);
    };
    reader.readAsText(file);
    fileInput.value = "";
});

saveBtn.addEventListener('click', saveFile);

modeBtn.addEventListener('click', () => {
    window.isStudentMode = !window.isStudentMode;
    modeBtn.src = window.isStudentMode ? "images/student_icon2.gif" : "images/pro_icon3.gif";
    statusMode.innerText = window.isStudentMode ? "Mode Étudiant" : "Mode Expert";
    logToConsole(`Passage en ${window.isStudentMode ? "Mode Étudiant" : "Mode Expert"}`, "info");
});

runBtn.addEventListener('click', () => {
    if (isRunning) {
        stopPythonManual();
        return;
    }
    
    if (!isWorkerReady) {
        logToConsole("Le moteur charge encore, patientez...", "info");
        return;
    }

    const activeTab = document.querySelector('.tab.active');
    if (!activeTab) return;

    const fileName = activeTab.querySelector('.tab-title').innerText.replace('*', '');
    const code = editor ? editor.getValue() : codeTextarea.value;

    isRunning = true;
    runBtn.src = "images/stop_icon2.gif";
    logToConsole(`Exécution de ${fileName}...`, "info");

    pythonWorker.postMessage({
        code: code,
        filename: fileName,
        is_student: window.isStudentMode
    });
});

/* --- RACCOURCIS CLAVIER --- */
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
});

/* --- SÉCURITÉ FERMETURE FENÊTRE --- */

window.addEventListener('beforeunload', (e) => {
    const filenames = Object.keys(fileContent);
    const hasUnsavedChanges = filenames.some(name => {
        return fileContent[name] !== savedFileContent[name];
    });

    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; 
        return ''; 
    }
});