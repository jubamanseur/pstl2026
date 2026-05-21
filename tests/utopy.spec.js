const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000'); 
    
    //attente de la console et du worker
    await expect(page.locator('.log-success', { hasText: 'utoPy est prêt et chargé !' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.log-success', { hasText: 'Moteur Python prêt (Worker).' })).toBeVisible({ timeout: 15000 });
});

test('L\'interface charge correctement et Pyodide s\'initialise', async ({ page }) => {
    //presence des boutons
    await expect(page.locator('#new-file-btn')).toBeVisible();
    await expect(page.locator('#run-btn')).toBeVisible();

    //worker pyodide
    const consoleReadyMessage = page.locator('.log-success', { hasText: 'utoPy est prêt et chargé !' });
    await expect(consoleReadyMessage).toBeVisible({ timeout: 15000 });
});

test('Créer un fichier, écrire du code et l\'exécuter', async ({ page }) => {
    //init
    await expect(page.locator('.log-success', { hasText: 'Moteur Python prêt (Worker).' })).toBeVisible({ timeout: 15000 });

    //interception du prompt et du nom du fichier
    page.on('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('test_etudiant.py'); //simule l'utilisateur qui tape le nom
    });

    //clic sur nouveau fichier
    await page.locator('#new-file-btn').click();

    //onglet créé et actif
    const activeTab = page.locator('.tab.active .tab-title');
    await expect(activeTab).toHaveText('test_etudiant.py');

    //ecriture du code dans codemirror
    //clic sur la zone puis ecriture au clavier
    await page.locator('.CodeMirror').click();
    await page.keyboard.type('print("Bonjour depuis Playwright")');

    //execution du code
    await page.locator('#run-btn').click();

    //verification du resultat dans la console
    //recherche d'un elt de log contenant le texte attendu
    const outputLog = page.locator('.log-info', { hasText: 'Bonjour depuis Playwright' });
    await expect(outputLog).toBeVisible({ timeout: 5000 });
});

test('Évaluer une expression directement dans la console', async ({ page }) => {
    await expect(page.locator('.log-success', { hasText: 'utoPy est prêt' })).toBeVisible({ timeout: 15000 });

    //tapotage de la cmd dans l'input de la console
    const evalInput = page.locator('#eval-input');
    await evalInput.fill('2 + 3');

    //eval
    await page.locator('#eval-btn').click();

    //verification de l'affichage
    const consoleContent = page.locator('#console-content');
    await expect(consoleContent).toContainText('>>> 2 + 3'); 
    await expect(consoleContent).toContainText('5');     
});

test('Basculer entre le Mode Étudiant et le Mode Expert', async ({ page }) => {
    const modeBtn = page.locator('#mode-btn');
    const statusMode = page.locator('#status-mode');
    const consoleLogs = page.locator('#console-content');

    //etat initial
    await expect(statusMode).toHaveText('Mode Étudiant');

    //expert
    await modeBtn.click();
    await expect(statusMode).toHaveText('Mode Expert');
    await expect(consoleLogs).toContainText('Passage en Mode Expert');

    //etudiant
    await modeBtn.click();
    await expect(statusMode).toHaveText('Mode Étudiant');
    await expect(consoleLogs).toContainText('Passage en Mode Étudiant');
});

test('La console évalue correctement les expressions', async ({ page }) => {
    const evalInput = page.locator('#eval-input');
    const evalBtn = page.locator('#eval-btn');
    const consoleContent = page.locator('#console-content');

    //taper une commande et valider avec le bouton
    await evalInput.fill('10 * 5');
    await evalBtn.click();

    //verification de l'affichage
    await expect(consoleContent).toContainText('>>> 10 * 5');
    await expect(consoleContent).toContainText('50');

    await evalInput.fill('print("ceci est un test")');
    await page.keyboard.press('Enter');
    await expect(consoleContent).toContainText('ceci est un test');
});

test('Ouverture et fermeture du guide interactif', async ({ page }) => {
    const guideBtn = page.locator('#guide-btn');
    const guideOverlay = page.locator('#guide-overlay');
    const guideTitle = page.locator('#guide-title');
    const guideCloseBtn = page.locator('#guide-close');

    //ouvrir
    await guideBtn.click();
    await expect(guideOverlay).toHaveClass(/active/);
    await expect(guideTitle).toHaveText('Bienvenue dans utoPy');

    //fermer
    await guideCloseBtn.click();
    await expect(guideOverlay).not.toHaveClass(/active/);
});

test('Fermeture d\'un onglet avec avertissement de non sauvegarde', async ({ page }) => {
    //creation du fichier
    page.once('dialog', dialog => dialog.accept('non_sauvegarde.py'));
    await page.locator('#new-file-btn').click();

    const activeTab = page.locator('.tab.active');
    const closeTabBtn = activeTab.locator('.close-tab');
    
    //ecriture
    await page.locator('.CodeMirror').click();
    await page.keyboard.type('x = 42');

    //verification que * apparait
    await expect(activeTab.locator('.tab-title')).toHaveText('non_sauvegarde.py*');

    //fermer l'onglet doit declencher un pop up de confirmation
    page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('Fichier non sauvegardé');
        await dialog.accept(); //forcer la fermeture
    });

    await closeTabBtn.click();

    //verification que l'onglet est fermé
    await expect(activeTab).not.toBeVisible();
});


// ----------------------------------------------------------------------
// scenario end to end
// ----------------------------------------------------------------------

test('Scénario complet : Création, fonction, exécution et vérification', async ({ page }) => {
    //interception du nom du fichier
    page.once('dialog', dialog => dialog.accept('calculatrice.py'));

    //creation du fichier
    await page.locator('#new-file-btn').click();
    const activeTabTitle = page.locator('.tab.active .tab-title');
    await expect(activeTabTitle).toHaveText('calculatrice.py');

    //ecriture d'une fonction dans l'éditeur
    const codePython = `def additionner(a, b):
    resultat = a + b
    return resultat

print("Début du calcul...")
somme = additionner(15, 27)
print(f"La somme de 15 et 27 est : {somme}")
`;
    await page.locator('.CodeMirror').click();
    await page.keyboard.insertText(codePython);

    //barre d'état bien mise à jour
    const statusPosition = page.locator('#status-position');
    //code de 7 lignes + saut de ligne final = 8
    await expect(statusPosition).toContainText('Li 8');

    //execution du code
    await page.locator('#run-btn').click();

    //output
    const consoleLogs = page.locator('#console-content');
    
    //verification du print
    await expect(consoleLogs).toContainText('Début du calcul...');
    
    //verification de l'appel, de l'execution et du fait que la fonction marche
    await expect(consoleLogs).toContainText('La somme de 15 et 27 est : 42');
});