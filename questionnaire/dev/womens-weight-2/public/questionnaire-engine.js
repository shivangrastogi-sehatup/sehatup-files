// assets/questionnaire-engine.js
class QuestionnaireEngine {

    constructor(config) {
        this.config = config;
        this.db = window.db;
        if (!this.db) {
            console.error('Firebase DB (window.db) is not initialized.');
            return;
        }

        const stepTwoLabel = document.getElementById('health-metrics-form')
            ? 'About You & Metrics'
            : 'About You';

        // 2. Define progressConfig based on the current config and determined label.
        this.progressConfig = [
            { id: 'about-you', label: stepTwoLabel, step: 2, displayStep: 1, key: 'userInfo', type: 'form' },

            ...this.config.questionGroups.map(g => ({
                id: g.key,
                label: g.key.charAt(0).toUpperCase() + g.key.slice(1),
                step: g.step,
                displayStep: g.step - 1,
                key: g.key,
                totalQuestions: g.questions.length,
            }))
        ];

        this.state = {
            currentStep: 1, // Start on the Welcome screen (internal step 1)
            userInfo: {},
            allAnswers: {},
            healthMetrics: { height: null, currentWeight: null, targetWeight: null, bmi: null }, // Retain metrics for persistence/pre-filling
            partialDocId: null,
            finalDocId: null,
            healthScore: 0,
            recommendedProducts: [],
            results: {},
        };

        const isWeightLossQuiz = config.id === 'weight-loss';

        // Initialize all answer keys
        this.config.questionGroups.forEach((group) => {
            this.state.allAnswers[group.key] = [];
        });

        this.otpTimer = null;
        this.enteredPhone = '';
        this.otpExpiresAt = 0;

        this.init();
    }

    async init() {
        console.log(`Initializing questionnaire: ${this.config.id}`);
        document.body.addEventListener('click', this.handleGlobalClick.bind(this));

        // Listeners for both separate forms
        document.getElementById('about-you-form')?.addEventListener('submit', (e) => e.preventDefault());
        document.getElementById('health-metrics-form')?.addEventListener('submit', (e) => e.preventDefault());

        document
            .querySelectorAll('.otp-input-group input')
            .forEach((input, index) => {
                this.setupOtpInputEvents(input, index);
            });

        await this.loadState();
        this.showStep(this.state.currentStep);
    }

    /**
     * 2. GLOBAL CLICK HANDLER
     */
    async handleGlobalClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        e.preventDefault();

        // Check if we need to call prevQuestion logic
        if (action === 'prev') {
            // This handles back from Step 2 (About You) to Step 1 (Welcome)
            this.showStep(parseInt(target.dataset.step, 10));
        } else if (action === 'start') {
            this.showStep(2); // Start the About You form (internal step 2)
        } else if (action === 'validate-user-info') {
            // New action to validate personal info and switch to metrics form (within step 2)
            this.validateUserInfo();
        } else if (action === 'prev-to-user-info') {
            // New action to switch back from metrics form to personal info form (within step 2)
            this.switchForm(true);
        } else if (action === 'validate-metrics') {
            // Validates metrics and moves to step 3 (Questions)
            this.validateHealthMetrics();
        } else if (action === 'answer-question') {
            this.handleAnswer(target.dataset);
        } else if (action === 'submit-multi-select') {
            this.handleMultiSelectSubmit();
        } else if (action === 'prev-question') {
            this.prevQuestion();
        } else if (action === 'load-youtube') {
            this.loadYoutubeVideo(target);
        } else if (action === 'open-otp') {
            this.openOtpPopup();
        } else if (action === 'close-otp') {
            this.closeOtpPopup();
        } else if (action === 'send-otp') {
            this.sendOtp();
        } else if (action === 'resend-otp') {
            this.resendOtp();
        } else if (action === 'verify-otp') {
            this.verifyOtpFromInputs();
        } else if (action === 'buy-now') {
            await this.buyNow();
        } else if (action === 'copy-coupon') {
            this.copyCouponCode();
        } else if (action === 'close-modal') {
            this.closeModal(target);
        }
    }

    /**
     * Helper to switch between forms in Step 2
     * @param {boolean} showUserInfo - true to show user info, false to show metrics
     */
    switchForm(showUserInfo) {
        const infoSection = document.getElementById('user-info-section');
        const metricsSection = document.getElementById('metrics-section');

        if (infoSection) {
            infoSection.style.display = showUserInfo ? 'block' : 'none';
        }

        // Only attempt to show/hide the metrics section if it exists
        if (metricsSection) {
            metricsSection.style.display = showUserInfo ? 'none' : 'block';
        }
        this.scrollToTopIfMobile();
    }


    /**
     * 3. CORE NAVIGATION & RENDERING
     */
    showStep(step) {
        this.state.currentStep = step;
        document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
        document.getElementById('questionnaire').classList.remove('results-mode');

        const header = document.querySelector('#questionnaire .header');

        // Hide header on all steps except Welcome
        if (header) {
            header.style.display = step === 1 ? 'block' : 'none';
        }

        // The total steps are 7 (1, 2, 3, 4, 5, 6, 7). Step 7 is the last question group. Step 8 is results.
        const questionGroup = this.config.questionGroups.find((g) => g.step === step);

        if (questionGroup) {
            document.getElementById('step-question').classList.add('active');
            this.renderQuestionGroup(questionGroup);
        } else if (step === 7) {
            // This is the Results step (1 + total question groups)
            document.getElementById('step-7').classList.add('active');
            this.finishQuestionnaire();
        } else if (step === 2) {
            // STEP 2: About You + Metrics (form step)
            const stepEl = document.getElementById(`step-${step}`);
            if (stepEl) stepEl.classList.add('active');

            // Determine which form to show on load/resume
            // Check if the elements exist for the weight questionnaire
            const hasMetricsForm = document.getElementById('height') !== null; // <--- NEW CHECK

            if (hasMetricsForm) { // Logic for 'womens-weight'
                if (this.state.healthMetrics.height) {
                    this.switchForm(false); // Metrics are already entered, show metrics form
                } else if (this.state.userInfo.name) {
                    this.switchForm(false); // User info entered, show metrics form
                } else {
                    this.switchForm(true); // Nothing entered, show user info form
                }
            } else {
                // Logic for 'womens-wellness' (only user info form exists)
                this.switchForm(true); // Always show user info form if no metrics form is present
            }

            // Pre-fill personal info (This is safe for both)
            document.getElementById('name').value = this.state.userInfo.name || '';
            document.getElementById('dob').value = this.state.userInfo.dob || '';
            document.getElementById('phone').value = this.state.userInfo.phone || '';

            // Pre-fill metrics fields ONLY if they exist
            if (hasMetricsForm) { // <--- NEW CHECK
                document.getElementById('height').value = this.state.healthMetrics.height || '';
                document.getElementById('currentWeight').value = this.state.healthMetrics.currentWeight || '';
                document.getElementById('targetWeight').value = this.state.healthMetrics.targetWeight || '';
            } // <--- END NEW CHECK

        } else {
            // STEP 1: Welcome
            const stepEl = document.getElementById(`step-${step}`);
            if (stepEl) stepEl.classList.add('active');
        }

        // --- STEP INDICATOR VISIBILITY CONTROL ---
        const desktopSteps = document.getElementById('desktop-steps');
        const mobileIndicator = document.getElementById('mobile-step-indicator');

        // Show indicators for steps 2 through 6 (inclusive). Hide for step 1 and 7.
        if (step >= 2 && step <= 6) {
            if (desktopSteps) desktopSteps.style.display = 'flex';
            if (mobileIndicator) mobileIndicator.style.display = 'block';
        } else {
            if (desktopSteps) desktopSteps.style.display = 'none';
            if (mobileIndicator) mobileIndicator.style.display = 'none';
        }
        // --- END INDICATOR VISIBILITY CONTROL ---

        // Update progress only for relevant steps (steps 2 through 6)
        if (step >= 2 && step <= 6) {
            this.updateStepIndicators();
        }

        this.scrollToTopIfMobile();
        this.persistData();
    }

    /**
     * Renders the Desktop and Mobile step indicators.
     */
    updateStepIndicators() {
        // We only call this function for internal steps 2 through 6.
        const currentGroupConfig = this.progressConfig.find(g => g.step === this.state.currentStep);
        if (!currentGroupConfig) return;

        const totalQuestionsAnsweredInStep = this.state.allAnswers[currentGroupConfig.key]?.length || 0;
        const totalQuestionsInStep = currentGroupConfig.totalQuestions || 1;

        // --- 1. MOBILE INDICATOR UPDATE ---
        const mobileNumberContainer = document.getElementById('mobile-step-number-container');
        const mobileCounter = document.getElementById('mobile-question-counter');
        const mobileStepName = document.getElementById('mobile-step-name');
        const mobileProgressFill = document.getElementById('mobile-step-progress-fill');

        if (mobileNumberContainer) mobileNumberContainer.textContent = currentGroupConfig.displayStep;
        if (mobileStepName) mobileStepName.textContent = currentGroupConfig.label;

        let mobileProgressPercentage = 0;

        // Step 2 is the form step
        if (currentGroupConfig.type === 'form') {
            mobileCounter.textContent = `Q1 / 1`;
            mobileProgressPercentage = 0;
        } else {
            mobileCounter.textContent = `Q${totalQuestionsAnsweredInStep + 1} / ${totalQuestionsInStep}`;
            mobileProgressPercentage = (totalQuestionsAnsweredInStep / totalQuestionsInStep) * 100;
        }

        if (mobileProgressFill) {
            mobileProgressFill.style.width = `${mobileProgressPercentage}%`;
        }


        // --- 2. DESKTOP STEPS UPDATE ---
        const desktopContainer = document.getElementById('desktop-steps');
        if (!desktopContainer) return;

        // Filter to only show the progress steps (internal steps 2 through 6)
        const stepsToShow = this.progressConfig.filter(g => g.step >= 2 && g.step <= 6);

        // Check if the HTML elements have been created yet (i.e., on initial load/first quiz step)
        const isInitialRender = desktopContainer.children.length === 0;

        stepsToShow.forEach((group) => {
            const stepId = group.id; // e.g., 'about-you', 'health', 'lifestyle'
            const isCurrent = group.step === this.state.currentStep;
            const isCompleted = group.step < this.state.currentStep;

            let progress = 0;
            const groupAnswers = this.state.allAnswers[group.key] || [];
            const qCount = group.totalQuestions || 1;

            if (isCompleted) {
                progress = 100;
            } else if (isCurrent) {
                if (group.type === 'form') {
                    progress = 0;
                } else {
                    progress = (groupAnswers.length / qCount) * 100;
                }
            }

            const fillColor = '#4c51bf';
            const titleClass = isCurrent ? 'text-primary-blue' : isCompleted ? 'text-gray-900' : 'text-gray-500';

            if (isInitialRender) {
                // --- INITIAL RENDER: BUILD THE HTML STRUCTURE WITH UNIQUE IDs ---
                const stepHtml = `
            <div class="step-container" data-step-id="${stepId}">
              <div class="step-title ${titleClass}">
                  ${group.label}
              </div>
              <div class="progress-bar-segment">
                  <div id="desktop-progress-fill-${stepId}" class="progress-bar-fill" 
                          style="width: 0%; background-color: ${fillColor};"></div>
              </div>
            </div>
        `;
                desktopContainer.insertAdjacentHTML('beforeend', stepHtml);
            }

            // --- UPDATE LOGIC: FIND EXISTING ELEMENT AND CHANGE STYLE ---
            const fillElement = document.getElementById(`desktop-progress-fill-${stepId}`);
            const titleElement = desktopContainer.querySelector(`[data-step-id="${stepId}"] .step-title`);

            if (fillElement) {
                // This triggers the CSS transition!
                fillElement.style.width = `${progress}%`;
                fillElement.style.backgroundColor = fillColor; // Ensure color is set
            }
            if (titleElement) {
                // Update the title class
                titleElement.className = `step-title ${titleClass}`;
            }
        });
    }

    /**
     * Renders the current question and updates UI elements.
     * @param {object} group - The current question group.
     */
    renderQuestionGroup(group) {
        const container = document.getElementById('question-content');
        const navContainer = document.getElementById('next-button-container');
        container.innerHTML = '';
        navContainer.innerHTML = '';

        if (!this.state.allAnswers[group.key]) {
            this.state.allAnswers[group.key] = [];
        }
        const qIndex = this.state.allAnswers[group.key].length;

        if (qIndex >= group.questions.length) {
            this.showStep(this.state.currentStep + 1);
            return;
        }

        const q = group.questions[qIndex];
        let optionsHTML = '';

        if (q.multiple) {
            optionsHTML = q.options
                .map(
                    (opt) => `
                        <label class="multi-option-card">
                            <input type="checkbox" class="multi-checkbox" value="${opt.text}"
                    data-score="${opt.score}">
                            <span class="multi-label">${opt.text}</span>
                        </label>
                    `
                )
                .join('');
            optionsHTML = `<div class="multi-select-container">${optionsHTML}</div>`;
            navContainer.innerHTML = `<button class="next-btn" data-action="submit-multi-select">Next</button>`;
        } else {
            optionsHTML = q.options
                .map(
                    (opt) => `
                        <button class="option-button" data-action="answer-question" 
                            data-group-key="${group.key}" data-question="${q.question}" 
                            data-text="${opt.text}" data-score="${opt.score}">
                            ${opt.text}
                        </button>
                    `
                )
                .join('');
            optionsHTML = `<div class="options">${optionsHTML}</div>`;
        }

        container.innerHTML = `
            <h2>${q.question}</h2>
            ${optionsHTML}
        `;

        if (q.multiple) {
            this.setupMultiSelectNoneLogic(container);
        }

        this.scrollToTopIfMobile();
        this.updateStepIndicators();
    }

    /**
     * Validates and saves personal information (Internal Step 2 - Form 1)
     */
    validateUserInfo() {
        const name = document.getElementById('name').value.trim();
        const dob = document.getElementById('dob').value;
        const phone = document.getElementById('phone').value.trim();
        let isValid = true;

        document.getElementById('name-error').innerText = '';
        document.getElementById('age-error').innerText = '';
        document.getElementById('phone-error').innerText = '';

        if (!name) {
            document.getElementById('name-error').innerText = 'Please enter your name.';
            isValid = false;
        }

        if (!dob) {
            document.getElementById('age-error').innerText =
                'Please enter your date of birth.';
            isValid = false;
        } else {
            const age = new Date().getFullYear() - new Date(dob).getFullYear();
            if (age < 18) {
                document.getElementById('age-error').innerText = 'You must be at least 18.';
                isValid = false;
            }
        }
        if (!/^\d{10}$/.test(phone)) {
            document.getElementById('phone-error').innerText =
                'Please enter a valid 10-digit phone number.';
            isValid = false;
        }
        if (!isValid) return;

        // Save userInfo when form is valid
        this.state.userInfo = {
            name,
            dob,
            phone,
            // Preserve existing metrics if user navigates back
            ...this.state.healthMetrics
        };

        if (!this.state.partialDocId) {
            const partialDocRef = this.db.collection('partial_submissions').doc();
            this.state.partialDocId = partialDocRef.id;
            localStorage.setItem(
                `partialDocId_${this.config.id}`,
                this.state.partialDocId
            );
        }
        const metricsSection = document.getElementById('metrics-section');

        if (metricsSection) {
            // If metrics form exists, switch to it (womens-weight logic)
            this.switchForm(false);
        } else {
            // If metrics form does NOT exist, proceed to the first question group (Step 3)
            // This is the logic for 'womens-wellness'
            this.state.userInfo = {
                ...this.state.userInfo,
                age: new Date().getFullYear() - new Date(dob).getFullYear(), // Calculate age for completeness
            };
            this.showStep(3);
        }

        this.persistData();

    }


    /**
     * Validates and saves health metrics (Internal Step 2 - Form 2)
     */
    validateHealthMetrics() {
        const heightInput = document.getElementById('height');
        const currentWeightInput = document.getElementById('currentWeight');
        const targetWeightInput = document.getElementById('targetWeight');

        const height = heightInput.value.trim();
        const currentWeight = currentWeightInput.value.trim();
        const targetWeight = targetWeightInput.value.trim();
        let isValid = true;

        document.getElementById('height-error').innerText = '';
        document.getElementById('weight-error').innerText = '';
        document.getElementById('targetWeight-error').innerText = '';

        const h = parseFloat(height);
        const cw = parseFloat(currentWeight);
        const tw = parseFloat(targetWeight);

        if (!h || h < 100 || h > 250) {
            document.getElementById('height-error').innerText = 'Enter a realistic height (100-250 cm).';
            isValid = false;
        }
        if (!cw || cw < 20 || cw > 300) {
            document.getElementById('weight-error').innerText = 'Enter a valid current weight (min 20kg).';
            isValid = false;
        }
        if (!tw || tw < 20 || tw > 300) {
            document.getElementById('targetWeight-error').innerText = 'Enter a valid target weight.';
            isValid = false;
        }

        if (isValid && tw >= cw) {
            document.getElementById('targetWeight-error').innerText = 'Target weight must be less than current weight.';
            isValid = false;
        }

        if (!isValid) return;

        const heightM = h / 100;
        const bmi = cw / (heightM * heightM);
        const age = new Date().getFullYear() - new Date(this.state.userInfo.dob).getFullYear();

        // 🔑 Save metrics to state
        this.state.healthMetrics = {
            height: h,
            currentWeight: cw,
            targetWeight: tw,
            bmi: parseFloat(bmi.toFixed(1)),
        };

        // Merge metrics into userInfo for scoring logic
        this.state.userInfo = {
            ...this.state.userInfo,
            ...this.state.healthMetrics,
            age: age
        };

        // Move to the next step (First question group - internal step 3)
        this.showStep(3);
    }


    handleAnswer(dataset) {
        const { groupKey, question, text, score } = dataset;
        // Check if the answer already exists (to prevent multiple clicks)
        const answerExists = this.state.allAnswers[groupKey].some(a => a.question === question);
        if (answerExists) {
            // This case should not happen with single-select buttons, but just in case:
            this.state.allAnswers[groupKey].pop(); // Remove the last (current) answer
        }

        this.state.allAnswers[groupKey].push({
            question,
            text,
            score: parseInt(score, 10),
        });

        const currentGroup = this.config.questionGroups.find((g) => g.key === groupKey);
        this.renderQuestionGroup(currentGroup);
        this.persistData();
    }

    handleMultiSelectSubmit() {
        const group = this.config.questionGroups.find(
            (g) => g.step === this.state.currentStep
        );
        const container = document.getElementById('question-content');
        const checkboxes = container.querySelectorAll(
            'input[type=checkbox]:checked'
        );

        // Find the "Next" button in the navigation to disable/enable
        const nextButton = document.querySelector('[data-action="submit-multi-select"]');

        if (checkboxes.length === 0) {
            this.showNonBlockingMessage('Please select at least one option.');
            return;
        }

        // Disable button while processing (good practice)
        if (nextButton) nextButton.disabled = true;

        let totalScore = 0;
        let selectedTexts = [];
        let hasNone = false;

        checkboxes.forEach((cb) => {
            if (String(cb.value).toLowerCase().trim() === 'none') {
                hasNone = true;
            } else {
                selectedTexts.push(cb.value);
                totalScore += parseInt(cb.dataset.score, 10);
            }
        });

        // If "None" was selected, or if no other options were selected, treat it as only "None"
        if (hasNone || selectedTexts.length === 0) {
            selectedTexts = ['None'];
            totalScore = 0;
        }

        this.state.allAnswers[group.key].push({
            question: container.querySelector('h2').innerText,
            text: selectedTexts,
            score: totalScore,
        });

        if (nextButton) nextButton.disabled = false; // Re-enable button

        this.renderQuestionGroup(group);
        this.persistData();
    }

    prevQuestion() {
        // Find the current group by step
        const currentGroup = this.config.questionGroups.find(
            (g) => g.step === this.state.currentStep
        );

        if (!currentGroup) {
            // Case 1: Currently on a non-question step (Should be Step 2 - About You/Metrics)
            if (this.state.currentStep === 2) {
                // Check if the user is currently on the metrics form inside step 2
                if (document.getElementById('metrics-section').style.display !== 'none') {
                    // If on metrics form, go back to user info form (inside step 2)
                    this.switchForm(true);
                } else {
                    // If on user info form, go back to step 1
                    this.showStep(1);
                }
            }
            else if (this.state.currentStep > 1) {
                this.showStep(this.state.currentStep - 1);
            }
            return;
        }

        // Case 2: Currently on a question within a group (internal steps 3-6)
        const answeredQuestions = this.state.allAnswers[currentGroup.key];
        if (answeredQuestions.length > 0) {
            answeredQuestions.pop(); // Remove the last answer
            this.renderQuestionGroup(currentGroup); // Rerenders the remaining questions/last one
        } else {
            // Case 3: On the very first question of a group, so move to the previous *major* step.
            const prevStep = this.state.currentStep - 1;

            // Optional: Remove the answer for the last question of the previous group 
            if (prevStep >= 3) { // Previous step is another question group
                const prevGroup = this.config.questionGroups.find((g) => g.step === prevStep);
                if (prevGroup && this.state.allAnswers[prevGroup.key]?.length > 0) {
                    this.state.allAnswers[prevGroup.key].pop();
                }
            }

            // Show the previous step (e.g., from step 3 (Health) back to step 2 (Metrics/About You))
            this.showStep(prevStep);
        }

        this.persistData();
    }

    // ... (rest of the functions: finishQuestionnaire, renderResults, loadState, etc.)

    scrollToTopIfMobile() {
        if (window.innerWidth < 768) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    }

    /**
    * 5. FINAL SUBMISSION & RESULTS
    */

    finishQuestionnaire() {
        this.showLoader();

        // 1. Calculate Score & Get Recommended Products
        this.state.healthScore = this.config.calculateScore(this.state.allAnswers, this.state.userInfo, this.config);

        this.state.recommendedProducts = this.config.productRules(
            this.state.healthScore,
            this.state.allAnswers,
            this.config.productDatabase,
            this.state.userInfo,
            this.config
        );

        this.state.results = this.config.resultRules(
            this.state.healthScore,
            this.state.allAnswers,
            this.config,
            this.state.userInfo
        );

        // 🔑 USE THE CONFIG'S saveSubmission FUNCTION 🔑
        const saveSubmission = this.config.saveSubmission;
        if (typeof saveSubmission !== 'function') {
            // Handle error if the config is missing the required function
            console.error('Configuration missing required saveSubmission function.');
            this.hideLoader();
            this.showNonBlockingMessage('Configuration error: Cannot save results.');
            return;
        }
        
        // Helper function to introduce a delay using a Promise
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const saveToFirebase = async () => {
            let finalDocId = null;
            try {
                // Execute the questionnaire-specific save logic
                finalDocId = await saveSubmission(
                    this.state,
                    this.db,
                    this.config
                );

                this.state.finalDocId = finalDocId; // Save the ID to state

                // Add the whatsapp_requests subcollection after getting the finalDocId
                const docRef = this.db.collection('questionnaire_submissions').doc(finalDocId);
                await docRef.collection('whatsapp_requests').add({
                    status: 'pending',
                    requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    message: `User completed ${this.config.id} and requested WhatsApp support`,
                    sent: false,
                });
                console.log('WhatsApp request subcollection added.');

                // Delete the partial submission
                const partialDocId = this.state.partialDocId;
                if (partialDocId) {
                    try {
                        await this.db
                            .collection('partial_submissions')
                            .doc(partialDocId)
                            .delete();
                        console.log('Partial data deleted after full submission.');
                        localStorage.removeItem(`partialDocId_${this.config.id}`);
                        this.state.partialDocId = null; // Clear from state
                    } catch (err) {
                        console.error('Error deleting partial data:', err);
                        // Fallback delete attempt (kept from original code)
                        try {
                            await this.db
                                .collection(`partial_${this.config.id}`)
                                .doc(partialDocId)
                                .delete();
                            console.log('Partial data deleted from fallback collection.');
                            localStorage.removeItem(`partialDocId_${this.config.id}`);
                            this.state.partialDocId = null; // Clear from state
                        } catch (e2) {
                            console.error('Fallback delete also failed:', e2);
                        }
                    }
                }
            } catch (e) {
                console.error('Error saving to Firebase:', e);
                this.hideLoader();
                this.showNonBlockingMessage('There was an error saving your report. Please try again.');
                return;
            }

            const FIXED_DELAY_MS = 2000; // 2 second delay
            await delay(FIXED_DELAY_MS);

            // --- RENDER RESULTS ---
            this.renderResults();
            document
                .getElementById('questionnaire')
                .classList.add('full-screen-results');
            document.getElementById('step-7').classList.add('active');
            this.hideLoader();
        };

        saveToFirebase();
    }

    renderResults() {
        document.getElementById('user-name').innerText = this.state.userInfo.name;
        document.getElementById('user-concern').innerText =
            this.state.results.issueTitle;
        document.getElementById('condition-text').innerHTML =
            this.state.results.conditionTextHTML;

        const riskContainer = document.getElementById('future-risk-tags');
        riskContainer.innerHTML = '';
        this.state.results.futureRisks.forEach((risk) => {
            riskContainer.innerHTML += `<div class="risk-tag">${risk}</div>`;
        });

        const mainTimelineTitle = document.querySelector('.results-timeline h3');
        const timelineContainer = document.getElementById(
            'condition-timeline-container'
        );
        timelineContainer.innerHTML = '';
        const timelineData = this.state.results.timelineData;
        if (mainTimelineTitle) {
            mainTimelineTitle.innerHTML = `Start Seeing Results In <span class="highlight-text">6
                Months</span>`;
        }
        const mergedTimeline = {};
        timelineData.general.forEach((item) => {
            if (!mergedTimeline[item.month]) {
                mergedTimeline[item.month] = { general: '', extras: [] };
            }
            mergedTimeline[item.month].general = item.timelineDesc;
        });

        /* This loop is now commented out to prevent 'extras' from being added
             to the merged timeline */

        // timelineData.extras.forEach(section => {
        //  section.timeline.forEach(item => {
        //    if (!mergedTimeline[item.month]) {
        //      mergedTimeline[item.month] = { general: '', extras: [] };
        //    }
        //    mergedTimeline[item.month].extras.push(item.timelineDesc);
        //  });
        // });

        let timelineHTML = '<div class="timeline-months">';
        const months = Object.keys(mergedTimeline).sort((a, b) => {
            let numA = parseInt(a.match(/\d+/)[0]);
            let numB = parseInt(b.match(/\d+/)[0]);
            return numA - numB;
        });
        months.forEach((monthKey, index) => {
            const data = mergedTimeline[monthKey];
            const extrasHTML = data.extras
                .map((desc) => `<p class="extra-desc">${desc}</p>`)
                .join('');
            timelineHTML += `
                <div class="month-box">
                    <div class="month-icon">
                        <img
                            src="https://cdn.shopify.com/s/files/1/0924/5687/8383/files/image_277.png?v=1741590675"
                            alt="${monthKey}" />
                    </div>
                    <h4>${monthKey}</h4>
                    <p class="general-desc">${data.general}</p>
                    ${extrasHTML}
                </div>
            `;
            if (index < months.length - 1) {
                timelineHTML += '<div class="line"></div>';
            }
        });
        timelineHTML += '</div>';
        timelineContainer.innerHTML = timelineHTML;

        this.animateScore(this.state.healthScore);

        const productList = document.getElementById('product-list');
        let total = 0;
        productList.innerHTML = '';
        // 🔑 KEY FIX: Filter only ACTIVE products for display and total calculation 🔑
        const activeProducts = this.state.recommendedProducts.filter(p => p.active);

        activeProducts.forEach((product) => {
            // NOTE: Since activeProducts is already filtered, the 'if (product.active)' check is removed.
            productList.innerHTML += `
                <div class="product-card" data-action="open-product-modal" 
                    data-name="${product.name}" 
                    data-description="${product.description || ''}" 
                    data-price="₹${product.salePrice}" data-image="${product.image}">
                    
                    <img src="${product.image}" alt="${product.name}">
                    <div class="product-name">${product.name}</div>
                    <div class="price-section">
                        <span class="old-price">₹${product.regularPrice}</span>
                        <span class="new-price">₹${product.salePrice}</span>
                    </div>
                </div>
            `;
            // Only add to the total if it's active (which it is, because of the filter)
            total += product.salePrice;
        });

        document.getElementById('total-amount').textContent = 'Rs.' + total;
        // 🔑 END FIX 🔑

        this.renderUGCContent();
    }

    async loadState() {
        const docId = localStorage.getItem(`partialDocId_${this.config.id}`);

        // 1. If no saved session, just exit. Quiz starts at step 1.
        if (!docId) return;

        // 2. Found a saved session. Ask the user what to do.
        // ** CUSTOM MODAL FOR CONFIRMATION (NO window.confirm) **
        this.showResumeModal(
            "Welcome back!",
            "Do you want to resume your previous session?",
            "Resume",
            "Restart",
            async (shouldResume) => {
                if (shouldResume) {
                    // --- USER WANTS TO RESUME ---
                    try {
                        const docRef = this.db.collection('partial_submissions').doc(docId);
                        const docSnap = await docRef.get();

                        if (docSnap.exists) {
                            console.log('Loading previous session...');
                            const loadedState = docSnap.data();

                            // Restore the state
                            const oldAllAnswers = this.state.allAnswers;
                            this.state = { ...this.state, ...loadedState };
                            this.state.allAnswers = {
                                ...oldAllAnswers,
                                ...loadedState.allAnswers,
                            };

                            // Ensure all answer keys exist
                            this.config.questionGroups.forEach((group) => {
                                if (!this.state.allAnswers[group.key]) {
                                    this.state.allAnswers[group.key] = [];
                                }
                            });

                            // Pre-fill "About You" form fields
                            document.getElementById('name').value = this.state.userInfo.name || '';
                            document.getElementById('dob').value = this.state.userInfo.dob || '';
                            document.getElementById('phone').value = this.state.userInfo.phone || '';

                            // Pre-fill metrics fields
                            document.getElementById('height').value = this.state.healthMetrics.height || '';
                            document.getElementById('currentWeight').value = this.state.healthMetrics.currentWeight || '';
                            document.getElementById('targetWeight').value = this.state.healthMetrics.targetWeight || '';

                            // Show the correct step
                            this.showStep(this.state.currentStep);

                        } else {
                            // ID was saved, but doc was deleted from Firebase. Start fresh.
                            localStorage.removeItem(`partialDocId_${this.config.id}`);
                            this.showStep(1); // Show step 1
                        }
                    } catch (e) {
                        console.error('Error loading state:', e);
                        localStorage.removeItem(`partialDocId_${this.config.id}`);
                        this.showStep(1); // Show step 1
                    }
                } else {
                    // --- USER WANTS TO RESTART ---
                    console.log('Restarting questionnaire. Deleting old partial data.');

                    // Delete the old doc from Firebase (so it doesn't count as a drop-off)
                    try {
                        await this.db.collection('partial_submissions').doc(docId).delete();
                    } catch (e) {
                        console.error('Error deleting partial data:', e);
                    }

                    // Clear the ID from storage
                    localStorage.removeItem(`partialDocId_${this.config.id}`);

                    // The state.currentStep will remain '1' (its default), so the
                    // init() function will correctly call showStep(1).
                    this.showStep(1); // Show step 1
                }
            }
        );

        // The original showStep(1) in init() will run, but the async modal
        // will eventually call showStep() again with the *correct* step (either 1 or loaded step)
    }

    setupMultiSelectNoneLogic(container) {
        const checkboxes = container.querySelectorAll('.multi-checkbox');
        
        // Define an array of keywords that trigger mutual exclusion
        const exclusiveKeywords = ['none', 'no']; 

        // Find the exclusive checkboxes
        const exclusiveCheckboxes = Array.from(checkboxes).filter(cb => 
            exclusiveKeywords.includes(String(cb.value).toLowerCase().trim())
        );
        
        // No exclusive options exist, no further logic is needed
        if (exclusiveCheckboxes.length === 0) return;

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const targetValue = String(e.target.value).toLowerCase().trim();
                const isExclusiveOption = exclusiveKeywords.includes(targetValue);
                
                if (isExclusiveOption) {
                    // If an exclusive option is checked, deselect all others
                    if (e.target.checked) {
                        checkboxes.forEach(cb => {
                            if (cb !== e.target) {
                                cb.checked = false;
                            }
                        });
                    }
                } else {
                    // If any other non-exclusive option is checked, deselect ALL exclusive options
                    if (e.target.checked) {
                        exclusiveCheckboxes.forEach(exclusiveCb => {
                            exclusiveCb.checked = false;
                        });
                    }
                }
            });
        });
    }

    // Custom modal to replace window.confirm
    showResumeModal(title, text, confirmText, cancelText, callback) {
        let modalId = 'resume-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal'; // Use your existing modal class
            modal.style.display = 'flex'; // Make it visible

            modal.innerHTML = `
                <div class="modal-content">
                    <h3 style="margin-top: 0;"><span
                        style="color: #4364f7; margin-right: 10px;">👋</span>${title}</h3>
                    <p>${text}</p>
                    <div class="modal-actions">
                        <button id="resume-cancel">${cancelText}</button>
                        <button id="resume-confirm">${confirmText}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('resume-confirm').onclick = () => {
                modal.style.display = 'none';
                callback(true);
            };
            document.getElementById('resume-cancel').onclick = () => {
                modal.style.display = 'none';
                callback(false);
            };
        }
        modal.style.display = 'flex';
    }


    async persistData() {
        if (!this.state.partialDocId) return;
        const docRef = this.db
            .collection('partial_submissions')
            .doc(this.state.partialDocId);
        const dataToSave = {
            ...this.state,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        };
        delete dataToSave.config; // Do not save the large config object
        delete dataToSave.results; // Do not save results in partial
        delete dataToSave.healthScore; // Do not save score in partial
        try {
            await docRef.set(dataToSave, { merge: true });
            console.log('Partial data persisted.');
        } catch (e) {
            console.error('Error persisting data:', e);
        }
    }

    /**
     * 7. HELPER & MODAL FUNCTIONS
     */
    showLoader() {
        document.getElementById('loader').style.display = 'flex';
    }
    hideLoader() {
        document.getElementById('loader').style.display = 'none';
    }
    closeModal(target) {
        const modal = target.closest('.modal');
        if (modal) modal.style.display = 'none';
    }

    renderUGCContent() {
        const ugcContainer = document.getElementById('ugc-content');
        if (!ugcContainer) return;

        const sliderHTML = `
                <h3>Customer Reviews</h3>
                <div class="ugc-slider">
                    <div class="ugc-slide ugc-slide-lite" data-action="load-youtube"
                        data-src="https://www.youtube.com/embed/68SbZuINym0">
                        <img class="ugc-thumbnail"
                            src="https://i.ytimg.com/vi/68SbZuINym0/hqdefault.jpg"
                            alt="Customer Review Thumbnail" onerror="this.style.display='none';">
                        <div class="play-button"></div>
                    </div>
                    <div class="ugc-slide ugc-slide-lite" data-action="load-youtube"
                        data-src="https://www.youtube.com/embed/EyvZLDLxFYU">
                        <img class="ugc-thumbnail"
                            src="https://i.ytimg.com/vi/EyvZLDLxFYU/hqdefault.jpg"
                            alt="Customer Review Thumbnail" onerror="this.style.display='none';">
                        <div class="play-button"></div>
                    </div>
                    <div class="ugc-slide ugc-slide-lite" data-action="load-youtube"
                        data-src="https://www.youtube.com/embed/i_lfAg9o4HA">
                        <img class="ugc-thumbnail"
                            src="https://i.ytimg.com/vi/i_lfAg9o4HA/hqdefault.jpg"
                            alt="Customer Review Thumbnail" onerror="this.style.display='none';">
                        <div class="play-button"></div>
                    </div>
                </div>
            `;
        ugcContainer.innerHTML = sliderHTML;
        ugcContainer.style.display = 'block'; // Ensure it's visible
    }

    // ⬇️ REPLACE this function ⬇️
    loadYoutubeVideo(target) {
        const slide = target.closest('.ugc-slide-lite');
        if (!slide) return;

        const src = slide.dataset.src;
        if (!src) return;

        const iframe = document.createElement('iframe');
        // Add autoplay=1 to start the video immediately
        iframe.src = src + '?autoplay=1&mute=1'; // Added mute=1, required by many browsers for autoplay
        iframe.allow =
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;

        // --- ADDED THESE STYLES ---
        // These are critical to make the iframe fill the container
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.border = 'none';
        // --- END OF ADDED STYLES ---

        // Clear the slide content (thumbnail and play button)
        slide.innerHTML = '';
        slide.appendChild(iframe);

        // Clean up classes
        slide.classList.remove('ugc-slide-lite');
        slide.removeAttribute('data-action');
    }

    animateScore(finalScore) {
        let currentScore = 0;
        const progressValue = document.getElementById('progress-value');
        const progressBar = document.getElementById('circular-progress');
        if (!progressValue || !progressBar) {
            console.error('Score animation elements not found');
            return;
        }

        finalScore = Math.max(0, Math.min(100, finalScore));

        progressValue.innerText = '0%';
        progressBar.style.background = 'conic-gradient(#eee 0deg, #eee 0deg)';

        const interval = setInterval(() => {
            currentScore++;
            if (currentScore >= finalScore) {
                currentScore = finalScore;
                clearInterval(interval);
            }
            progressValue.innerText = currentScore + '%';
            let color = this.getScoreColor(currentScore);
            progressBar.style.background = `conic-gradient(${color} ${currentScore * 3.6
                }deg, #eee ${currentScore * 3.6}deg)`;
        }, 20);
    }

    getScoreColor(score) {
        if (score < 50) return 'red';
        else if (score < 80) return 'orange';
        else return '#4caf50';
    }
    async buyNow() {
        // 1. Get all products that are marked as 'active'
        const activeProducts = this.state.recommendedProducts.filter(
            (product) => product.active
        );

        if (activeProducts.length === 0) {
            this.showNonBlockingMessage('There are no products available for purchase at this time.');
            return;
        }

        // 2. Show a loading state on the button
        const buyButton = document.querySelector('[data-action="buy-now"]');
        buyButton.innerText = 'Adding to cart...';
        buyButton.disabled = true;

        // 3. Create a list of items to add
        const itemsToAdd = activeProducts.map((product) => {
            return {
                id: product.variantId,
                quantity: 1,
            };
        });

        // 4. Use Shopify's Cart API to add all items at once
        try {
            await fetch('/cart/add.js', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: itemsToAdd,
                }),
            });

            // 5. Success! Now go to the cart page.
            window.location.href = '/cart';
        } catch (error) {
            console.error('Failed to add items to cart:', error);
            this.showNonBlockingMessage('There was an error adding products to your cart. Please try again.');
            // Reset button on failure
            buyButton.innerText = 'Buy Now';
            buyButton.disabled = false;
        }
    }

    copyCouponCode() {
        const couponInput = document.getElementById('coupon-code');
        const feedback = document.getElementById('copy-feedback');
        document.execCommand('copy');
        feedback.style.display = 'block';
        setTimeout(() => {
            feedback.style.display = 'none';
        }, 1500);
    }

    // --- OTP Methods (No changes from your file) ---

    setupOtpInputEvents(input, index) {
        const inputs = document.querySelectorAll(".otp-input-group input");

        input.addEventListener("keydown", (e) => {
            const key = e.key;

            if (key === "Backspace") {
                input.value = "";
                if (index > 0) inputs[index - 1].focus();
                e.preventDefault();
            } else if (key >= "0" && key <= "9") {
                // Allow number, overwrite current
                input.value = ""; // clear existing before inserting
            } else if (key === "ArrowLeft" && index > 0) {
                inputs[index - 1].focus();
            } else if (key === "ArrowRight" && index < inputs.length - 1) {
                inputs[index + 1].focus();
            } else if (!["Tab", "Enter"].includes(key)) {
                e.preventDefault(); // prevent non-numeric input
            }
        });

        input.addEventListener("input", function () {
            const val = input.value;
            if (/^\d$/.test(val)) {
                if (index < inputs.length - 1) inputs[index + 1].focus();
            } else {
                input.value = ""; // clear non-digit input
            }
        });
    }


    openOtpPopup() {
        const modal = document.getElementById("otp-modal");
        const phoneInput = document.getElementById("otp-phone");

        // Pre-fill phone number from the user info saved in step 2
        phoneInput.value = this.state.userInfo.phone || "";
        this.enteredPhone = this.state.userInfo.phone || "";

        document.getElementById("otp-step-1").style.display = "block";
        document.getElementById("otp-step-2").style.display = "none";
        modal.style.display = "flex";
        this.resetOtpInputs();
    }

    closeOtpPopup() {
        document.getElementById("otp-modal").style.display = "none";
        clearInterval(this.otpTimer);
    }

    resetOtpInputs() {
        document.querySelectorAll(".otp-input-group input").forEach(inp => inp.value = "");
        document.getElementById("otp-toast").style.display = "none";
    }

    showOtpToast(msg, color = "green") {
        const toast = document.getElementById("otp-toast");
        toast.innerText = msg;
        toast.style.color = color;
        toast.style.display = "block";
        setTimeout(() => (toast.style.display = "none"), 4000);
    }

    startOtpTimer() {
        let otpTimeLeft = 60;
        this.otpExpiresAt = Date.now() + 60000; // Set expiration time

        const timerEl = document.getElementById("otp-timer");
        const resendLink = document.getElementById("resend-link");

        resendLink.style.display = "none";
        timerEl.innerText = `Resend in ${otpTimeLeft}s`;
        timerEl.style.display = "inline";

        clearInterval(this.otpTimer);
        this.otpTimer = setInterval(() => {
            otpTimeLeft--;
            if (otpTimeLeft > 0) {
                timerEl.innerText = `Resend in ${otpTimeLeft}s`;
            } else {
                clearInterval(this.otpTimer);
                timerEl.innerText = "";
                resendLink.style.display = "inline";
            }
        }, 1000);
    }

    sendOtp() {
        const phone = document.getElementById("otp-phone").value.trim();
        if (!/^\d{10}$/.test(phone)) {
            this.showOtpToast("Enter valid 10-digit number", "red");
            return;
        }

        this.enteredPhone = phone;

        fetch("https://generateotp-xrtgefpbxq-em.a.run.app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Use an object property shorthand for the body
            body: JSON.stringify({ phone }),
        })
            .then(res => res.json())
            .then(() => {
                this.showOtpToast("OTP Sent!");
                document.getElementById("otp-step-1").style.display = "none";
                document.getElementById("otp-step-2").style.display = "block";
                this.resetOtpInputs();
                this.startOtpTimer();
            })
            .catch(() => this.showOtpToast("Failed to send OTP", "red"));
    }

    resendOtp() {
        if (!this.enteredPhone || !/^\d{10}$/.test(this.enteredPhone)) {
            this.showOtpToast("Invalid phone number", "red");
            return;
        }

        // Disable further clicks temporarily
        const resendLink = document.getElementById("resend-link");
        resendLink.style.pointerEvents = "none";
        resendLink.style.opacity = "0.6";

        // Clear the timer and reset inputs before fetching
        clearInterval(this.otpTimer);
        this.resetOtpInputs();

        fetch("https://generateotp-xrtgefpbxq-em.a.run.app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: this.enteredPhone }),
        })
            .then(() => {
                this.showOtpToast("OTP Resent!");
                resendLink.style.pointerEvents = "auto";
                resendLink.style.opacity = "1";
                this.startOtpTimer();
            })
            .catch(() => {
                this.showOtpToast("Failed to resend OTP", "red");
                resendLink.style.pointerEvents = "auto";
                resendLink.style.opacity = "1";
            });
    }

    async verifyOtpFromInputs() {
        const digits = Array.from(document.querySelectorAll(".otp-input-group input")).map(i => i.value).join("");
        if (digits.length < 6) {
            this.showOtpToast("Enter full 6-digit OTP", "red");
            return;
        }

        // Open a new window immediately, but don't set location until verified
        var windowReference = window.open();
        if (!windowReference) {
            // Handle popup blockers gracefully
            this.showToast("Please allow pop-ups to open the WhatsApp chat.", "red");
            return;
        }


        fetch("https://verifyotp-xrtgefpbxq-em.a.run.app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: this.enteredPhone, otp: digits }),
        })
            .then(res => res.json())
            .then(async (data) => { // Use async here to await Firebase update
                if (data.success) {
                    this.showOtpToast("OTP Verified");

                    // If the user entered a NEW phone number, update the Firestore record
                    if (this.enteredPhone !== this.state.userInfo.phone && this.state.finalDocId) {
                        try {
                            await this.db.collection("questionnaire_submissions")
                                .doc(this.state.finalDocId)
                                .set({
                                    phone: this.enteredPhone,
                                    "rawState.userInfo.phone": this.enteredPhone // Update in raw state too
                                }, { merge: true });

                            console.log("Phone updated in Firebase");
                            this.state.userInfo.phone = this.enteredPhone; // Update running state
                        } catch (error) {
                            console.error("Error updating phone in Firebase:", error);
                        }
                    }

                    // Navigate the opened window
                    windowReference.location = `https://wa.me/919355539355?text=i want my detailed healthscore360 report for testing purposes only`;
                    this.closeOtpPopup();

                } else {
                    windowReference.close(); // Close the blank window if verification fails
                    this.showOtpToast("Incorrect or expired OTP. Please double-check or resend.", "red");
                }
            })
            .catch(() => {
                if (windowReference) windowReference.close();
                this.showOtpToast("Verification failed due to network error.", "red");
            });
    }
}
document.addEventListener('DOMContentLoaded', () => {
    if (
        typeof questionnaireConfig !== 'undefined' &&
        typeof window.db !== 'undefined'
    ) {
        window.myQuestionnaire = new QuestionnaireEngine(questionnaireConfig);
    } else {
        console.error(
            'Config file (questionnaireConfig) or Firebase (window.db) is missing.'
        );
    }
});