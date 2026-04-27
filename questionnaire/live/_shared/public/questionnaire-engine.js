// questionnaire-engine.js
class QuestionnaireEngine {
    constructor(config) {
        this.config = config;
        this.db = window.db;

        if (!this.db) {
            console.error('Firebase DB (window.db) is not initialized.');
            return;
        }

        const isMensWellnessQuiz = this.config.id === 'mens-wellness';
        const stepTwoLabel = document.getElementById('health-metrics-form') ? 'About You & Metrics' : 'About You';

        let initialProgressConfig = [{
            id: 'about-you',
            label: this.config.progressSteps?.find(p => p.key === 'about-you')?.label || 'About You',
            step: 2,
            displayStep: 1,
            key: 'userInfo',
            type: 'form'
        },];

        if (this.config.progressSteps && this.config.progressSteps.length > 0) {
            const staticSteps = this.config.progressSteps.filter(p => p.step > 2);
            let displayOffset = initialProgressConfig.length;

            staticSteps.forEach((s) => {
                initialProgressConfig.push({
                    id: s.key,
                    label: s.label,
                    step: s.step,
                    displayStep: s.step - 2,
                    key: s.key,
                    type: 'single-select'
                });
            });
        }

        const offset = initialProgressConfig.length - 1;
        this.progressConfig = [
            ...initialProgressConfig,
            ...this.config.questionGroups.map((g, index) => {
                const displayStep = g.step - offset;
                const label = g.label || (g.key.charAt(0).toUpperCase() + g.key.slice(1).replace(/_/g, ' '));
                return {
                    id: g.key,
                    label: label,
                    step: g.step,
                    displayStep: displayStep,
                    key: g.key,
                    totalQuestions: g.questions.length || 0,
                };
            })
        ];

        this.state = {
            currentStep: 1,
            userInfo: {},
            healthMetrics: {
                height: null,
                currentWeight: null,
                targetWeight: null,
                bmi: null
            },
            partialDocId: null,
            finalDocId: null,
            healthScore: 0,
            recommendedProducts: [],
            results: {},
            allAnswers: {
                concern: [],
            },
        };

        this.config.questionGroups.forEach((group) => {
            this.state.allAnswers[group.key] = this.state.allAnswers[group.key] || [];
        });

        this.otpTimer = null;
        this.enteredPhone = '';
        this.otpExpiresAt = 0;
        this.init();
    }

    async init() {
        // console.log(`Initializing questionnaire: ${this.config.id}`);
        document.body.addEventListener('click', this.handleGlobalClick.bind(this));
        document.getElementById('about-you-form')?.addEventListener('submit', (e) => e.preventDefault());
        document.getElementById('health-metrics-form')?.addEventListener('submit', (e) => e.preventDefault());

        document.querySelectorAll('.otp-input-group input').forEach((input, index) => {
            this.setupOtpInputEvents(input, index);
        });

        await this.loadState();
        this.showStep(this.state.currentStep);
    }

    async handleGlobalClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        e.preventDefault();

        if (action === 'select-concern') {
            this.handleConcernSelection(target.dataset.concernKey);
        } else if (action === 'prev') {
            this.showStep(parseInt(target.dataset.step, 10));
        } else if (action === 'start') {
            this.showStep(2);
        } else if (action === 'validate-user-info') {
            this.validateUserInfo();
        } else if (action === 'prev-to-user-info') {
            this.switchForm(true);
        } else if (action === 'validate-metrics') {
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

    switchForm(showUserInfo) {
        const infoSection = document.getElementById('user-info-section');
        const metricsSection = document.getElementById('metrics-section');
        if (infoSection) infoSection.style.display = showUserInfo ? 'block' : 'none';
        if (metricsSection) metricsSection.style.display = showUserInfo ? 'none' : 'block';
        this.scrollToTopIfMobile();
    }

    showStep(step) {
        this.state.currentStep = step;
        const questionnaireEl = document.getElementById('questionnaire');
        if (questionnaireEl) questionnaireEl.classList.remove('results-mode');

        document.querySelectorAll('.step').forEach((s) => {
            if (s && s.classList) s.classList.remove('active');
        });

        const header = document.querySelector('#questionnaire .header');
        if (header) header.style.display = step === 1 ? 'block' : 'none';

        const lastQuestionGroup = this.config.questionGroups[this.config.questionGroups.length - 1];
        const resultsStep = lastQuestionGroup ? lastQuestionGroup.step + 1 : 2;

        if (step === resultsStep) {
            const originalStep = this.state.currentStep;
            this.state.currentStep = lastQuestionGroup.step;
            const desktopSteps = document.getElementById('desktop-steps');
            const mobileIndicator = document.getElementById('mobile-step-indicator');

            if (desktopSteps) desktopSteps.style.display = 'flex';
            if (mobileIndicator) mobileIndicator.style.display = 'block';

            this.updateStepIndicators();
            this.state.currentStep = originalStep;

            const stepQuestionEl = document.getElementById('step-question');
            if (stepQuestionEl) stepQuestionEl.classList.add('active');

            const contentContainer = document.getElementById('question-content');
            const navContainer = document.getElementById('question-navigation');
            if (navContainer) navContainer.style.display = 'none';

            if (contentContainer) {
                contentContainer.innerHTML = `
                    <div class="thank-you-card" style="text-align: center; padding: 40px 20px; animation: fadein 0.8s;">
                        <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
                        <h2 style="margin-bottom: 15px; color: #333; font-weight: bold;">Great Job!</h2>
                        <p style="font-size: 18px; color: #555; line-height: 1.6;">
                            Thank you for completing the assessment.<br>
                            We are now generating your personalized report.
                        </p>
                        <style>
                            @keyframes fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                        </style>
                    </div>
                `;
            }
            setTimeout(() => {
                if (desktopSteps) desktopSteps.style.display = 'none';
                if (mobileIndicator) mobileIndicator.style.display = 'none';
                this.finishQuestionnaire();
            }, 2000);
            return;
        }

        const navContainer = document.getElementById('question-navigation');
        if (navContainer) navContainer.style.display = 'flex';

        const questionGroup = this.config.questionGroups.find((g) => g.step === step);
        if (questionGroup) {
            if (step === 3 && this.config.id === 'mens-wellness' && questionGroup.key === 'concern') {
                const step3El = document.getElementById('step-3');
                if (step3El) step3El.classList.add('active');
                this.updateStepIndicators();
                this.scrollToTopIfMobile();
                this.persistData();
                return;
            }
            const stepQuestionEl = document.getElementById('step-question');
            if (stepQuestionEl) {
                stepQuestionEl.classList.add('active');
                this.renderQuestionGroup(questionGroup);
            }
        } else {
            const stepEl = document.getElementById(`step-${step}`);
            if (stepEl) stepEl.classList.add('active');
        }

        const desktopSteps = document.getElementById('desktop-steps');
        const mobileIndicator = document.getElementById('mobile-step-indicator');
        const lastQuestionStep = this.config.questionGroups.length > 0 ? this.config.questionGroups[this.config.questionGroups.length - 1].step : 2;

        if (step >= 2 && step <= lastQuestionStep) {
            if (desktopSteps) desktopSteps.style.display = 'flex';
            if (mobileIndicator) mobileIndicator.style.display = 'block';
            this.updateStepIndicators();
        } else {
            if (desktopSteps) desktopSteps.style.display = 'none';
            if (mobileIndicator) mobileIndicator.style.display = 'none';
        }

        this.scrollToTopIfMobile();
        this.persistData();
    }

    handleConcernSelection(concernKey) {
        const config = this.config;
        if (config.id !== 'mens-wellness') return;

        this.state.allAnswers.concern = [{
            question: "Selected Challenge",
            text: concernKey.toUpperCase(),
            score: 0
        }];
        this.state.allAnswers.sexual_health = [];

        const dynamicGroup = config.questionGroups.find(g => g.key === 'sexual_health');
        if (dynamicGroup) {
            dynamicGroup.questions = config.questionBank[concernKey] || [];
            this.progressConfig = this.progressConfig.map(g => {
                if (g.key === 'sexual_health') {
                    return {
                        ...g,
                        totalQuestions: dynamicGroup.questions.length
                    };
                }
                return g;
            });
        }
        this.showStep(4);
    }

    updateStepIndicators() {
        const currentGroupConfig = this.progressConfig.find(g => g.step === this.state.currentStep);
        if (!currentGroupConfig) return;

        const totalQuestionsAnsweredInStep = this.state.allAnswers[currentGroupConfig.key]?.length || 0;
        const totalQuestionsInStep = currentGroupConfig.totalQuestions || 1;

        const mobileNumberContainer = document.getElementById('mobile-step-number-container');
        const mobileCounter = document.getElementById('mobile-question-counter');
        const mobileStepName = document.getElementById('mobile-step-name');
        const mobileProgressFill = document.getElementById('mobile-step-progress-fill');

        if (mobileNumberContainer) mobileNumberContainer.textContent = currentGroupConfig.displayStep;
        if (mobileStepName) mobileStepName.textContent = currentGroupConfig.label;

        let mobileProgressPercentage = 0;
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

        const desktopContainer = document.getElementById('desktop-steps');
        if (!desktopContainer) return;

        const totalProgressSteps = this.config.questionGroups.length + 1;
        const stepsToShow = this.progressConfig.slice(0, totalProgressSteps);
        const isInitialRender = desktopContainer.children.length === 0;

        stepsToShow.forEach((group) => {
            const stepId = group.id;
            const isCurrent = group.step === this.state.currentStep;
            const isCompleted = group.step < this.state.currentStep;

            let progress = 0;
            const groupAnswers = this.state.allAnswers[group.key] || [];
            const qCount = group.totalQuestions || 1;

            if (isCompleted) {
                progress = 100;
            } else if (isCurrent) {
                progress = group.type === 'form' ? 0 : (groupAnswers.length / qCount) * 100;
            }

            const fillColor = '#4c51bf';
            const titleClass = isCurrent ? 'text-primary-blue' : isCompleted ? 'text-gray-900' : 'text-gray-500';

            if (isInitialRender) {
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

            const fillElement = document.getElementById(`desktop-progress-fill-${stepId}`);
            const titleElement = desktopContainer.querySelector(`[data-step-id="${stepId}"] .step-title`);
            if (fillElement) {
                fillElement.style.width = `${progress}%`;
                fillElement.style.backgroundColor = fillColor;
            }
            if (titleElement) {
                titleElement.className = `step-title ${titleClass}`;
            }
        });
    }

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
            optionsHTML = q.options.map((opt) => `
                <label class="multi-option-card">
                    <input type="checkbox" class="multi-checkbox" value="${opt.text}" data-score="${opt.score}">
                    <span class="multi-label">${opt.text}</span>
                </label>
            `).join('');
            optionsHTML = `<div class="multi-select-container">${optionsHTML}</div>`;
            navContainer.innerHTML = `<button class="next-btn" data-action="submit-multi-select">Next</button>`;
        } else {
            optionsHTML = q.options.map((opt) => `
                <button class="option-button" data-action="answer-question" 
                    data-group-key="${group.key}" data-question="${q.question}" 
                    data-text="${opt.text}" data-score="${opt.score}">
                    ${opt.text}
                </button>
            `).join('');
            optionsHTML = `<div class="options">${optionsHTML}</div>`;
        }

        container.innerHTML = `<h2>${q.question}</h2>${optionsHTML}`;
        if (q.multiple) {
            this.setupMultiSelectNoneLogic(container);
        }

        this.scrollToTopIfMobile();
        this.updateStepIndicators();
    }

    async validateUserInfo() {
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
            document.getElementById('age-error').innerText = 'Please enter your date of birth.';
            isValid = false;
        } else {
            const age = new Date().getFullYear() - new Date(dob).getFullYear();
            if (age < 18) {
                document.getElementById('age-error').innerText = 'You must be at least 18.';
                isValid = false;
            }
        }
        if (!/^\d{10}$/.test(phone)) {
            document.getElementById('phone-error').innerText = 'Please enter a valid 10-digit phone number.';
            isValid = false;
        }

        if (!isValid) return;

        this.state.userInfo = { name, dob, phone, ...this.state.healthMetrics };

        if (!this.state.partialDocId) {
            const partialDocRef = this.db.collection('partial_submissions').doc();
            this.state.partialDocId = partialDocRef.id;

            localStorage.setItem(`partialDocId_${this.config.id}`, this.state.partialDocId);

            // 🔥 CREATE DOCUMENT IMMEDIATELY (Matching Prod Schema)
            // console.log("Initializing partial sync...");
            try {
                await partialDocRef.set({
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    name: name,
                    dob: dob,
                    phone: phone,
                    status: "incomplete",
                    reminderSent: false,
                    questionnaireId: this.config.id,
                    createdAt: new Date(), // Keep internal tracking too
                    lastUpdated: new Date()
                });
                // console.log("Partial doc created.");
            } catch (err) {
                console.error("❌ Error creating partial doc:", err);
                console.error("Firebase Details:", {
                    project: window.firebaseConfig?.projectId,
                    db: !!this.db
                });
            }
        }

        const metricsSection = document.getElementById('metrics-section');
        if (metricsSection) {
            this.switchForm(false);
        } else {
            this.state.userInfo.age = new Date().getFullYear() - new Date(dob).getFullYear();
            this.showStep(3);
        }
        this.persistData();
    }

    validateHealthMetrics() {
        const h = parseFloat(document.getElementById('height').value.trim());
        const cw = parseFloat(document.getElementById('currentWeight').value.trim());
        const tw = parseFloat(document.getElementById('targetWeight').value.trim());
        let isValid = true;

        document.getElementById('height-error').innerText = '';
        document.getElementById('weight-error').innerText = '';
        document.getElementById('targetWeight-error').innerText = '';

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

        const bmi = cw / ((h / 100) ** 2);
        const age = new Date().getFullYear() - new Date(this.state.userInfo.dob).getFullYear();

        this.state.healthMetrics = {
            height: h,
            currentWeight: cw,
            targetWeight: tw,
            bmi: parseFloat(bmi.toFixed(1)),
        };

        this.state.userInfo = { ...this.state.userInfo, ...this.state.healthMetrics, age };
        this.showStep(3);
    }

    handleAnswer(dataset) {
        const { groupKey, question, text, score } = dataset;
        const answerExists = this.state.allAnswers[groupKey].some(a => a.question === question);
        if (answerExists) {
            this.state.allAnswers[groupKey].pop();
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
        const group = this.config.questionGroups.find((g) => g.step === this.state.currentStep);
        const container = document.getElementById('question-content');
        const checkboxes = container.querySelectorAll('input[type=checkbox]:checked');
        const nextButton = document.querySelector('[data-action="submit-multi-select"]');

        if (checkboxes.length === 0) {
            this.showNonBlockingMessage('Please select at least one option.');
            return;
        }

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

        if (hasNone || selectedTexts.length === 0) {
            selectedTexts = ['None'];
            totalScore = 0;
        }

        this.state.allAnswers[group.key].push({
            question: container.querySelector('h2').innerText,
            text: selectedTexts,
            score: totalScore,
        });

        if (nextButton) nextButton.disabled = false;
        this.renderQuestionGroup(group);
        this.persistData();
    }

    prevQuestion() {
        const currentGroup = this.config.questionGroups.find((g) => g.step === this.state.currentStep);
        const firstQuestionStep = this.config.questionGroups[0]?.step;

        if (!currentGroup) {
            const lastQuestionGroup = this.config.questionGroups[this.config.questionGroups.length - 1];
            const resultsStep = lastQuestionGroup ? lastQuestionGroup.step + 1 : 2;

            if (this.state.currentStep === resultsStep) {
                this.showStep(lastQuestionGroup.step);
            } else if (this.state.currentStep > 1) {
                this.showStep(this.state.currentStep - 1);
            }
            return;
        }

        const answeredQuestions = this.state.allAnswers[currentGroup.key];
        if (answeredQuestions.length > 0) {
            answeredQuestions.pop();
            this.renderQuestionGroup(currentGroup);
        } else if (this.state.currentStep > firstQuestionStep) {
            this.showStep(this.state.currentStep - 1);
        } else {
            this.showStep(2);
        }
        this.persistData();
    }

    scrollToTopIfMobile() {
        if (window.innerWidth < 768) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    finishQuestionnaire() {
        this.showLoader();
        this.state.healthScore = this.config.calculateScore(this.state.allAnswers, this.state.userInfo, this.config);
        this.state.recommendedProducts = this.config.productRules(this.state.healthScore, this.state.allAnswers, this.config.productDatabase, this.state.userInfo, this.config);
        this.state.results = this.config.resultRules(this.state.healthScore, this.state.allAnswers, this.config, this.state.userInfo);

        const saveSubmission = this.config.saveSubmission;
        if (typeof saveSubmission !== 'function') {
            console.error('Configuration missing saveSubmission function.');
            this.hideLoader();
            return;
        }

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const saveToFirebase = async () => {
            try {
                const finalDocId = await saveSubmission(this.state, this.db, this.config);
                this.state.finalDocId = finalDocId;

                fetch("https://script.google.com/macros/s/AKfycbwYNLb__I57oyfPeqVwl7xd-IW5m5avDt0G3PhDIPaji3ztUTl9OgnQXJDeGcVB8Kto/exec", {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        type: "completed",
                        id: finalDocId,
                        name: this.state.userInfo.name,
                        phone: this.state.userInfo.phone,
                        score: this.state.healthScore,
                        category: this.state.results.issueTitle,
                        recommendedProducts: this.state.recommendedProducts.filter(p => p.active).map(p => p.name)
                    })
                });

                const docRef = this.db.collection('questionnaire_submissions').doc(finalDocId);
                await docRef.collection('whatsapp_requests').add({
                    status: 'pending',
                    requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    message: `User completed ${this.config.id}`,
                    sent: false,
                });

                if (this.state.partialDocId) {
                    try {
                        await this.db.collection('partial_submissions').doc(this.state.partialDocId).delete();
                        localStorage.removeItem(`partialDocId_${this.config.id}`);
                        this.state.partialDocId = null;
                    } catch (e) { console.error(e); }
                }

                await delay(2000);
                this.hideLoader();
                this.renderResults();

                const questionnaireEl = document.getElementById('questionnaire');
                if (questionnaireEl) questionnaireEl.classList.add('full-screen-results');

                const stepQuestionEl = document.getElementById('step-question');
                if (stepQuestionEl) stepQuestionEl.classList.remove('active');

                const resultPageEl = document.getElementById('result-page');
                if (resultPageEl) resultPageEl.classList.add('active');

                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (e) {
                console.error('Error saving:', e);
                this.hideLoader();
                this.showNonBlockingMessage('Error saving report. Please check connection.');
            }
        };
        saveToFirebase();
    }

    renderResults() {
        document.getElementById('user-name').innerText = this.state.userInfo.name;
        document.getElementById('user-concern').innerText = this.state.results.issueTitle;
        document.getElementById('condition-text').innerHTML = this.state.results.conditionTextHTML;

        const riskContainer = document.getElementById('future-risk-tags');
        riskContainer.innerHTML = '';
        this.state.results.futureRisks.forEach((risk) => {
            riskContainer.innerHTML += `<div class="risk-tag">${risk}</div>`;
        });

        const mainTimelineTitle = document.querySelector('.results-timeline h3');
        const timelineContainer = document.getElementById('condition-timeline-container');
        timelineContainer.innerHTML = '';
        const timelineData = this.state.results.timelineData;

        if (mainTimelineTitle) {
            mainTimelineTitle.innerHTML = `Start Seeing Results In <span class="highlight-text">6 Months</span>`;
        }

        const mergedTimeline = {};
        timelineData.general.forEach((item) => {
            if (!mergedTimeline[item.month]) {
                mergedTimeline[item.month] = { general: '', extras: [] };
            }
            mergedTimeline[item.month].general = item.timelineDesc;
        });

        let timelineHTML = '<div class="timeline-months">';
        const months = Object.keys(mergedTimeline).sort((a, b) => {
            let numA = parseInt(a.match(/\d+/)[0]);
            let numB = parseInt(b.match(/\d+/)[0]);
            return numA - numB;
        });

        months.forEach((monthKey, index) => {
            const data = mergedTimeline[monthKey];
            const extrasHTML = data.extras.map((desc) => `<p class="extra-desc">${desc}</p>`).join('');
            timelineHTML += `
                <div class="month-box">
                    <div class="month-icon">
                        <img src="https://cdn.shopify.com/s/files/1/0924/5687/8383/files/timeline.webp?v=1774248748" alt="${monthKey}" />
                    </div>
                    <h4>${monthKey}</h4>
                    <p class="general-desc">${data.general}</p>
                    ${extrasHTML}
                </div>
            `;
            if (index < months.length - 1) timelineHTML += '<div class="line"></div>';
        });

        timelineHTML += '</div>';
        timelineContainer.innerHTML = timelineHTML;

        this.animateScore(this.state.healthScore);

        const productList = document.getElementById('product-list');
        let total = 0;
        productList.innerHTML = '';
        const activeProducts = this.state.recommendedProducts.filter(p => p.active);

        activeProducts.forEach((product) => {
            const hasDiscount = product.regularPrice > product.salePrice;
            const oldPriceHTML = hasDiscount ? `<span class="old-price">₹${product.regularPrice}</span>` : '';
            productList.innerHTML += `
                <div class="product-card" data-action="open-product-modal" 
                    data-name="${product.name}" 
                    data-description="${product.description || ''}" 
                    data-price="₹${product.salePrice}" data-image="${product.image}">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="product-name">${product.name}</div>
                    <div class="price-section">
                        ${oldPriceHTML}
                        <span class="new-price">₹${product.salePrice}</span>
                    </div>
                </div>
            `;
            total += product.salePrice;
        });
        document.getElementById('total-amount').textContent = 'Rs.' + total;
        this.renderUGCContent();
    }

    async loadState() {
        const docId = localStorage.getItem(`partialDocId_${this.config.id}`);
        if (!docId) return;

        this.showResumeModal("Welcome back!", "Do you want to resume your previous session?", "Resume", "Restart", async (shouldResume) => {
            if (shouldResume) {
                try {
                    const docSnap = await this.db.collection('partial_submissions').doc(docId).get();
                    if (docSnap.exists) {
                        const loadedState = docSnap.data();
                        const oldAllAnswers = this.state.allAnswers;
                        this.state = { ...this.state, ...loadedState };
                        this.state.allAnswers = { ...oldAllAnswers, ...loadedState.allAnswers };

                        this.config.questionGroups.forEach((group) => {
                            if (!this.state.allAnswers[group.key]) this.state.allAnswers[group.key] = [];
                        });

                        const setVal = (id, val) => {
                            const el = document.getElementById(id);
                            if (el) el.value = val || '';
                        };

                        setVal('name', this.state.userInfo.name);
                        setVal('dob', this.state.userInfo.dob);
                        setVal('phone', this.state.userInfo.phone);
                        setVal('height', this.state.healthMetrics.height);
                        setVal('currentWeight', this.state.healthMetrics.currentWeight);
                        setVal('targetWeight', this.state.healthMetrics.targetWeight);

                        this.showStep(this.state.currentStep);
                    } else {
                        localStorage.removeItem(`partialDocId_${this.config.id}`);
                        this.showStep(1);
                    }
                } catch (e) {
                    console.error('Error loading state:', e);
                    this.showStep(1);
                }
            } else {
                try { await this.db.collection('partial_submissions').doc(docId).delete(); } catch (e) { }
                localStorage.removeItem(`partialDocId_${this.config.id}`);
                this.showStep(1);
            }
        });
    }

    setupMultiSelectNoneLogic(container) {
        const checkboxes = container.querySelectorAll('.multi-checkbox');
        const exclusiveKeywords = ['none', 'no'];
        const exclusiveCheckboxes = Array.from(checkboxes).filter(cb => exclusiveKeywords.includes(String(cb.value).toLowerCase().trim()));

        if (exclusiveCheckboxes.length === 0) return;

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const isExclusive = exclusiveKeywords.includes(String(e.target.value).toLowerCase().trim());
                if (isExclusive && e.target.checked) {
                    checkboxes.forEach(cb => { if (cb !== e.target) cb.checked = false; });
                } else if (!isExclusive && e.target.checked) {
                    exclusiveCheckboxes.forEach(ecb => ecb.checked = false);
                }
            });
        });
    }

    showResumeModal(title, text, confirmText, cancelText, callback) {
        let modal = document.getElementById('resume-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'resume-modal';
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3 style="margin-top: 0;"><span style="color: #4364f7; margin-right: 10px;">👋</span>${title}</h3>
                    <p>${text}</p>
                    <div class="modal-actions">
                        <button id="resume-cancel">${cancelText}</button>
                        <button id="resume-confirm">${confirmText}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('resume-confirm').onclick = () => { modal.style.display = 'none'; callback(true); };
            document.getElementById('resume-cancel').onclick = () => { modal.style.display = 'none'; callback(false); };
        }
        modal.style.display = 'flex';
    }

    async persistData() {
        if (!this.state.partialDocId) return;
        const docRef = this.db.collection('partial_submissions').doc(this.state.partialDocId);
        const dataToSave = { ...this.state, lastUpdated: new Date() };
        // console.log("Syncing progress...");

        delete dataToSave.config;
        delete dataToSave.results;
        delete dataToSave.healthScore;

        try {
            // console.log("Sync attempted");
            await docRef.set(dataToSave, { merge: true });
            // console.log("Progress saved");
        } catch (e) {
            console.error('❌ Error persisting data:', e);
        }
    }

    showLoader() { document.getElementById('loader').style.display = 'flex'; }
    hideLoader() { document.getElementById('loader').style.display = 'none'; }
    closeModal(target) {
        const modal = target.closest('.modal');
        if (modal) modal.style.display = 'none';
    }

    renderUGCContent() {
        const ugcContainer = document.getElementById('ugc-content');
        if (!ugcContainer) return;
        ugcContainer.innerHTML = `
            <h3>Customer Reviews</h3>
            <div class="ugc-slider">
                ${['68SbZuINym0', 'EyvZLDLxFYU', 'i_lfAg9o4HA'].map(id => `
                    <div class="ugc-slide ugc-slide-lite" data-action="load-youtube" data-src="https://www.youtube.com/embed/${id}">
                        <img class="ugc-thumbnail" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="Review">
                        <div class="play-button"></div>
                    </div>
                `).join('')}
            </div>
        `;
        ugcContainer.style.display = 'block';
    }

    loadYoutubeVideo(target) {
        const slide = target.closest('.ugc-slide-lite');
        if (!slide || !slide.dataset.src) return;
        const iframe = document.createElement('iframe');
        iframe.src = slide.dataset.src + '?autoplay=1&mute=1';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.style.cssText = 'width:100%; height:100%; position:absolute; top:0; left:0; border:none;';
        slide.innerHTML = '';
        slide.appendChild(iframe);
        slide.classList.remove('ugc-slide-lite');
    }

    animateScore(finalScore) {
        let currentScore = 0;
        const progressValue = document.getElementById('progress-value');
        const progressBar = document.getElementById('circular-progress');
        if (!progressValue || !progressBar) return;

        finalScore = Math.max(0, Math.min(100, finalScore));
        const interval = setInterval(() => {
            currentScore++;
            if (currentScore >= finalScore) {
                currentScore = finalScore;
                clearInterval(interval);
            }
            progressValue.innerText = currentScore + '%';
            let color = this.getScoreColor(currentScore);
            progressBar.style.background = `conic-gradient(${color} ${currentScore * 3.6}deg, #eee ${currentScore * 3.6}deg)`;
        }, 20);
    }

    getScoreColor(score) {
        if (score < 50) return 'red';
        if (score < 80) return 'orange';
        return '#4caf50';
    }

    buyNow() {
        const activeProducts = this.state.recommendedProducts.filter(p => p.active);
        if (activeProducts.length === 0) {
            this.showNonBlockingMessage('No products available.');
            return;
        }

        const buyButton = document.querySelector('[data-action="buy-now"]');
        buyButton.innerText = 'Redirecting...';
        buyButton.disabled = true;

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/cart/add';

        activeProducts.forEach(product => {
            const inputId = document.createElement('input');
            inputId.type = 'hidden';
            inputId.name = 'id[]';
            inputId.value = Number(product.variantId);
            form.appendChild(inputId);

            const inputQty = document.createElement('input');
            inputQty.type = 'hidden';
            inputQty.name = 'quantity[]';
            inputQty.value = 1;
            form.appendChild(inputQty);
        });

        document.body.appendChild(form);
        form.submit();
    }

    // OTP and Input helper methods
    setupOtpInputEvents(input, index) {
        const inputs = document.querySelectorAll(".otp-input-group input");
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace") {
                input.value = "";
                if (index > 0) inputs[index - 1].focus();
                e.preventDefault();
            } else if (e.key >= "0" && e.key <= "9") {
                input.value = "";
            }
        });
        input.addEventListener("input", () => {
            if (/^\d$/.test(input.value) && index < inputs.length - 1) inputs[index + 1].focus();
        });
    }

    openOtpPopup() {
        const modal = document.getElementById("otp-modal");
        this.enteredPhone = this.state.userInfo.phone || "";
        document.getElementById("otp-phone").value = this.enteredPhone;
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
    }

    sendOtp() {
        const phone = document.getElementById("otp-phone").value.trim();
        if (!/^\d{10}$/.test(phone)) return;
        this.enteredPhone = phone;
        fetch("https://generateotp-xrtgefpbxq-em.a.run.app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
        }).then(() => {
            document.getElementById("otp-step-1").style.display = "none";
            document.getElementById("otp-step-2").style.display = "block";
            this.startOtpTimer();
        });
    }

    async verifyOtpFromInputs() {
        const digits = Array.from(document.querySelectorAll(".otp-input-group input")).map(i => i.value).join("");
        if (digits.length < 6) return;

        const verifyBtn = document.querySelector('[data-action="verify-otp"]');
        if (verifyBtn) {
            verifyBtn.disabled = true;
            verifyBtn.innerText = "Verifying...";
        }

        try {
            const response = await fetch("https://verifyotp-xrtgefpbxq-em.a.run.app", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: this.enteredPhone, otp: digits }),
            });
            const data = await response.json();

            if (data.success) {
                // SYNC PHONE NUMBER IF DIFFERENT
                const initialPhone = this.state.userInfo.phone;
                const verifiedPhone = this.enteredPhone;

                if (initialPhone !== verifiedPhone) {
                    console.log("Phone divergence detected. Syncing verified number with Firebase...");
                    this.state.userInfo.phone = verifiedPhone;

                    if (this.state.finalDocId) {
                        const docRef = this.db.collection('questionnaire_submissions').doc(this.state.finalDocId);
                        await docRef.update({
                            phone: verifiedPhone,
                            "rawState.userInfo.phone": verifiedPhone
                        });
                        console.log("✅ Final submission updated with verified phone.");
                    }
                }

                window.open(`https://wa.me/919355539355?text=I want my detailed healthscore360 report`, '_blank');
                this.closeOtpPopup();
            } else {
                alert("Invalid OTP. Please try again.");
                this.resetOtpInputs();
                const inputs = document.querySelectorAll(".otp-input-group input");
                if (inputs[0]) inputs[0].focus();
            }
        } catch (e) {
            console.error("OTP Verification Error:", e);
            alert("Verification failed. Please try again.");
        } finally {
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.innerText = "Verify & Get Report";
            }
        }
    }
}

// Initialization logic
document.addEventListener('DOMContentLoaded', () => {
    if (typeof questionnaireConfig !== 'undefined' && typeof window.db !== 'undefined') {
        window.myQuestionnaire = new QuestionnaireEngine(questionnaireConfig);
    } else {
        console.error('Config or Firebase missing.');
    }
});