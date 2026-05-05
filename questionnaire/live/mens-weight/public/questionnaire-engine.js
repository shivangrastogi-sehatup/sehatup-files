// questionnaire-engine.js
class QuestionnaireEngine {
    constructor(config) {
        this.config = config;
        this.version = "3.6.3"; // Deep Sync & Cache Busting
        this.db = window.db;
        console.log("ENGINE VERSION 3.6.3 LOADED");

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
            allAnswers: {},
            healthScore: 0,
            reportDate: null,
            results: {},
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

        this.otpExpiresAt = 0;

        // Localization Support
        this.currentLanguage = localStorage.getItem(`selected_lang_${this.config.id}`) || 'en';
        this.uiTranslations = {
            'en': {
                'main-title': "Men's Sexual Wellness Score",
                'welcome-title': "Welcome to the Men's Sexual Health Quiz!",
                'welcome-point-1': "Takes just a few minutes",
                'welcome-point-2': "100% private and secure",
                'welcome-point-3': "You must be 18 or older to participate",
                'btn-start': "Start Questionnaire",
                'btn-prev-report': "Show Previous Report",
                'personal-info-title': "Tell us a bit about yourself to personalize your experience.",
                'label-name': "Enter Your Full Name:",
                'label-dob': "Enter Your Date of Birth:",
                'label-phone': "Enter Your Phone Number:",
                'btn-prev': "Previous",
                'btn-next': "Next",
                'about-you': "About You",
                'challenge': "Challenge",
                'questions': "Questions",
                'lifestyle': "Lifestyle",
                'great-job': "Great Job!",
                'thank-you-msg': "Thank you for completing the assessment.<br>We are now generating your personalized report.",
                'placeholder-name': "Your name",
                'placeholder-phone': "Phone",
                'step-3-title': "Select the challenge you’re facing - we’re here to help",
                'btn-ed': "Erectile Dysfunction (ED)",
                'btn-pe': "Premature Ejaculation (PE)",
                'btn-both': "Both",
                'btn-back-to-quiz': "Back to Questionnaire",
                'report-title': "Assessment Report",
                'label-report-date': "Date:",
                'label-patient-name': "Patient Name",
                'label-primary-concern': "Primary Concern",
                'label-category': "Category",
                'mens-wellness-category': "Men's Wellness",
                'label-future-risk-title': "Future Risk (If Not Treated)",
                'btn-whatsapp-report': "Get My Report on WhatsApp",
                'timeline-title': "Condition-Based Progress Timeline",
                'included-plan-title': "What's included in your Plan",
                'expert-doctor-support': "Expert Doctor Support",
                'ayurvedic-medicine': "Ayurvedic Medicine",
                'custom-diet-exercise': "Custom Diet & Exercise",
                'recommended-treatment': "Recommended Treatment",
                'label-total-amount': "Total Amount:",
                'label-gst-included': "(GST included)",
                'btn-buy-now': "Buy Now",
                'critical-risk': "Critical Risk",
                'high-risk': "High Risk",
                'moderate-risk': "Moderate Risk",
                'low-risk': "Low Risk",
                'currency-symbol': "Rs.",
                'timeline-goal': 'Start Seeing Results In <span class="highlight-text">6 Months</span>',
                'redirecting': "Redirecting...",
                'calculating-health-report': "Calculating your personalized health report... 😊",
                'wait-moment': "Please wait a moment while we analyze your responses.",
                'reviews-title': "Customer Reviews",
                'otp-title-1': "Secure Your Report",
                'otp-msg-1': "Enter your phone number to receive your personalized health report via WhatsApp.",
                'otp-placeholder-phone': "Enter 10-digit phone number",
                'otp-btn-send': "Send Verification Code",
                'otp-title-2': "Verify Your Number",
                'otp-msg-2': "We've sent a 6-digit verification code to your phone.",
                'otp-resend-text': "Didn't receive the code?",
                'otp-resend-link': "Resend Code",
                'otp-btn-verify': "Verify & Access Report",
                'phone-warning': "Phone number must be exactly 10 digits.",
                'verifying': "Verifying..."
            },
            'hi': {
                'main-title': "पुरुष यौन स्वास्थ्य स्कोर",
                'welcome-title': "पुरुष यौन स्वास्थ्य प्रश्नोत्तरी में आपका स्वागत है!",
                'welcome-point-1': "इसमें केवल कुछ मिनट लगते हैं",
                'welcome-point-2': "100% निजी और सुरक्षित",
                'welcome-point-3': "भाग लेने के लिए आपकी आयु 18 वर्ष या उससे अधिक होनी चाहिए",
                'btn-start': "प्रश्नावली शुरू करें",
                'btn-prev-report': "पिछली रिपोर्ट दिखाएं",
                'personal-info-title': "अपने अनुभव को व्यक्तिगत बनाने के लिए हमें अपने बारे में थोड़ा बताएं।",
                'label-name': "अपना पूरा नाम दर्ज करें:",
                'label-dob': "अपनी जन्म तिथि दर्ज करें:",
                'label-phone': "अपना फोन नंबर दर्ज करें:",
                'btn-prev': "पिछला",
                'btn-next': "अगला",
                'about-you': "आपके बारे में",
                'challenge': "चुनौती",
                'questions': "प्रश्न",
                'lifestyle': "जीवनशैली",
                'great-job': "बहुत बढ़िया!",
                'thank-you-msg': "प्रश्नावली को पूरा करने के लिए धन्यवाद।<br>हम अब आपकी व्यक्तिगत रिपोर्ट तैयार कर रहे हैं।",
                'placeholder-name': "आपका नाम",
                'placeholder-phone': "फ़ोन नंबर",
                'step-3-title': "उस चुनौती को चुनें जिसका आप सामना कर रहे हैं - हम यहाँ मदद के लिए हैं",
                'btn-ed': "इरेक्टाइल डिसफंक्शन (ED)",
                'btn-pe': "शीघ्रपतन (PE)",
                'btn-both': "दोनों",
                'btn-back-to-quiz': "प्रश्नावली पर वापस जाएँ",
                'report-title': "आकलन रिपोर्ट",
                'label-report-date': "दिनांक:",
                'label-patient-name': "रोगी का नाम",
                'label-primary-concern': "मुख्य चिंता",
                'label-category': "श्रेणी",
                'mens-wellness-category': "पुरुष स्वास्थ्य",
                'label-future-risk-title': "भविष्य का जोखिम (यदि उपचार न किया गया)",
                'btn-whatsapp-report': "व्हाट्सएप पर मेरी रिपोर्ट प्राप्त करें",
                'timeline-title': "स्थिति-आधारित प्रगति समयरेखा",
                'included-plan-title': "आपके प्लान में क्या शामिल है",
                'expert-doctor-support': "विशेषज्ञ डॉक्टर सहायता",
                'ayurvedic-medicine': "आयुर्वेदिक दवा",
                'custom-diet-exercise': "कस्टम डाइट और व्यायाम",
                'recommended-treatment': "अनुशंसित उपचार",
                'label-total-amount': "कुल राशि:",
                'label-gst-included': "(GST शामिल)",
                'btn-buy-now': "अभी खरीदें",
                'critical-risk': "गंभीर जोखिम",
                'high-risk': "उच्च जोखिम",
                'moderate-risk': "मध्यम जोखिम",
                'low-risk': "कम जोखिम",
                'currency-symbol': "रु.",
                'timeline-goal': '<span class="highlight-text">6 महीनों</span> में परिणाम देखना शुरू करें',
                'redirecting': "अनुप्रेषण (Redirecting)...",
                'calculating-health-report': "आपकी व्यक्तिगत स्वास्थ्य रिपोर्ट तैयार की जा रही है... 😊",
                'wait-moment': "कृपया कुछ समय प्रतीक्षा करें जब हम आपके उत्तरों का विश्लेषण कर रहे हैं।",
                'reviews-title': "ग्राहकों की समीक्षा",
                'otp-title-1': "अपनी रिपोर्ट सुरक्षित करें",
                'otp-msg-1': "व्हाट्सएप के माध्यम से अपनी व्यक्तिगत स्वास्थ्य रिपोर्ट प्राप्त करने के लिए अपना फोन नंबर दर्ज करें।",
                'otp-placeholder-phone': "10-अंकीय फोन नंबर दर्ज करें",
                'otp-btn-send': "सत्यापन कोड भेजें",
                'otp-title-2': "अपना नंबर सत्यापित करें",
                'otp-msg-2': "हमने आपके फोन पर 6-अंकीय सत्यापन कोड भेजा है।",
                'otp-resend-text': "कोड प्राप्त नहीं हुआ?",
                'otp-resend-link': "कोड पुन: भेजें",
                'otp-btn-verify': "सत्यापित करें और रिपोर्ट देखें",
                'phone-warning': "फोन नंबर बिल्कुल 10 अंकों का होना चाहिए।",
                'verifying': "सत्यापित किया जा रहा है..."
            }
        };

        this.init();

        // Fix for "Redirecting..." being stuck on back navigation
        window.addEventListener('pageshow', (event) => {
            const buyButtons = document.querySelectorAll('[data-action="buy-now"]');
            buyButtons.forEach(btn => {
                if (btn.innerText === 'Redirecting...') {
                    btn.innerText = 'Buy Now';
                    btn.disabled = false;
                }
            });
        });
    }

    async init() {
        console.log(`Initializing questionnaire: ${this.config.id}`);
        this.updateStaticUI();
        this.updateLanguageToggle();
        
        document.body.addEventListener('click', this.handleGlobalClick.bind(this));
        document.getElementById('about-you-form')?.addEventListener('submit', (e) => e.preventDefault());
        document.getElementById('health-metrics-form')?.addEventListener('submit', (e) => e.preventDefault());

        document.querySelectorAll('.otp-input-group input').forEach((input, index) => {
            this.setupOtpInputEvents(input, index);
        });

        // Check for active session (refresh persistence)
        const savedState = localStorage.getItem(`active_session_state_${this.config.id}`);
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed && parsed.currentStep > 1) {
                    this.state = { ...this.state, ...parsed };
                    console.log(`Resuming local session at step ${this.state.currentStep}`);
                    this.showStep(this.state.currentStep);
                    return; // Skip loadState (Firestore) if we have a fresh local state
                }
            } catch (e) { console.error("Error parsing local state:", e); }
        }

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
        } else if (action === 'show-previous') {
            this.handleShowPreviousReport();
        } else if (action === 'go-back-from-results') {
            this.showStep(1);
        } else if (action === 'change-lang') {
            this.changeLanguage(target.dataset.lang);
        }
    }

    changeLanguage(lang) {
        console.log("Switching to language:", lang);
        if (this.currentLanguage === lang) return;
        this.currentLanguage = lang;
        localStorage.setItem(`selected_lang_${this.config.id}`, lang);
        
        // Unify the refresh logic to ensure both static and dynamic contents are in sync
        this.updateStaticUI();
        this.updateLanguageToggle();
        
        // Force refresh current step
        if (this.state.currentStep === 99) {
            this.renderResults();
        } else if (this.state.currentStep >= 3 && this.state.currentStep <= 98) {
            const group = this.config.questionGroups.find(g => g.step === this.state.currentStep);
            if (group) this.renderQuestionGroup(group);
        } else {
            this.showStep(this.state.currentStep);
        }
    }

    updateStaticUI(scope = document) {
        const langData = this.uiTranslations[this.currentLanguage];
        if (!langData) return;

        scope.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translation = langData[key];
            if (translation) {
                if (el.tagName === 'INPUT') {
                    el.placeholder = translation;
                } else {
                    el.innerHTML = translation;
                }
            }
        });

        // Update progress configs for headers
        this.progressConfig.forEach(p => {
            if (langData[p.id]) {
                p.label = langData[p.id];
            }
        });
        
        this.updateStepIndicators();
    }

    updateLanguageToggle() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.currentLanguage);
        });
    }

    switchForm(showUserInfo) {
        const infoSection = document.getElementById('user-info-section');
        const metricsSection = document.getElementById('metrics-section');
        if (infoSection) infoSection.style.display = showUserInfo ? 'block' : 'none';
        if (metricsSection) metricsSection.style.display = showUserInfo ? 'none' : 'block';
        // Visual Version Label for Debugging
        const footerNote = document.getElementById('footer-version-note');
        if (footerNote) {
            footerNote.innerText = `Version: ${this.version} [${lang.toUpperCase()}]`;
            footerNote.style.fontSize = '12px';
            footerNote.style.color = '#ccc';
            footerNote.style.marginTop = '20px';
        }

        this.scrollToTopIfMobile();
    }

    showStep(step) {
        this.state.currentStep = step;
        this.saveLocalState();
        const questionnaireEl = document.getElementById('questionnaire');
        if (questionnaireEl) {
            if (step === 99) { // Results mode
                questionnaireEl.classList.add('full-screen-results', 'results-mode');
            } else {
                questionnaireEl.classList.remove('full-screen-results', 'results-mode');
            }
        }

        document.querySelectorAll('.step').forEach((s) => {
            if (s && s.classList) s.classList.remove('active');
        });

        const header = document.querySelector('#questionnaire .header');
        if (header) header.style.display = step === 1 ? 'block' : 'none';

        const langSwitch = document.querySelector('.language-switch');
        if (langSwitch) langSwitch.style.display = 'flex'; // Always visible

        if (step === 1) {
            const step1El = document.getElementById('step-1');
            if (step1El) step1El.classList.add('active');
            const navigation = document.getElementById('question-navigation');
            if (navigation) navigation.style.display = 'none';
        }

        const lastQuestionGroup = this.config.questionGroups[this.config.questionGroups.length - 1];
        const resultsStep = lastQuestionGroup ? lastQuestionGroup.step + 1 : 2;

        if (step === resultsStep || step === 99) {
            const isJustShowingPrevious = step === 99;
            const originalStep = this.state.currentStep;
            
            if (!isJustShowingPrevious) {
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
                    const title = this.uiTranslations[this.currentLanguage]['great-job'] || "Great Job!";
                    const msg = this.uiTranslations[this.currentLanguage]['thank-you-msg'] || "Thank you for completing the assessment.<br>We are now generating your personalized report.";

                    contentContainer.innerHTML = `
                        <div class="thank-you-card" style="text-align: center; padding: 40px 20px; animation: fadein 0.8s;">
                            <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
                            <h2 style="margin-bottom: 15px; color: #333; font-weight: bold;">${title}</h2>
                            <p style="font-size: 18px; color: #555; line-height: 1.6;">
                                ${msg}
                            </p>
                            <style>
                                @keyframes fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                            </style>
                        </div>
                    `;
                }
                setTimeout(() => {
                    const dSteps = document.getElementById('desktop-steps');
                    const mInd = document.getElementById('mobile-step-indicator');
                    if (dSteps) dSteps.style.display = 'none';
                    if (mInd) mInd.style.display = 'none';
                    this.finishQuestionnaire();
                }, 2000);
            } else {
                // Just showing result page
                const dSteps = document.getElementById('desktop-steps');
                const mInd = document.getElementById('mobile-step-indicator');
                if (dSteps) dSteps.style.display = 'none';
                if (mInd) mInd.style.display = 'none';

                const resultPageEl = document.getElementById('result-page');
                if (resultPageEl) {
                    resultPageEl.classList.add('active');
                    this.renderResults(); // Ensure UI is populated with restored data
                }
            }
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
        const isHi = this.currentLanguage === 'hi';
        const questionText = (isHi && q.hi) ? q.hi : q.question;
        let optionsHTML = '';

        if (q.multiple) {
            optionsHTML = q.options.map((opt) => {
                const optText = (isHi && opt.hi) ? opt.hi : opt.text;
                return `
                <label class="multi-option-card">
                    <input type="checkbox" class="multi-checkbox" value="${opt.text}" data-score="${opt.score}">
                    <span class="multi-label">${optText}</span>
                </label>
                `;
            }).join('');
            optionsHTML = `<div class="multi-select-container">${optionsHTML}</div>`;
            navContainer.innerHTML = `<button class="next-btn" data-action="submit-multi-select">${this.uiTranslations[this.currentLanguage]['btn-next']}</button>`;
        } else {
            optionsHTML = q.options.map((opt) => {
                const optText = (isHi && opt.hi) ? opt.hi : opt.text;
                return `
                <button class="option-button" data-action="answer-question" 
                    data-group-key="${group.key}" data-question="${q.question}" 
                    data-text="${opt.text}" data-score="${opt.score}">
                    ${optText}
                </button>
                `;
            }).join('');
            optionsHTML = `<div class="options">${optionsHTML}</div>`;
        }

        container.innerHTML = `<h2>${questionText}</h2>${optionsHTML}`;
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
            console.log("Attempting to create partial doc in 'partial_submissions' with ID:", this.state.partialDocId);
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
                console.log("✅ Partial doc SUCCESSFULLY CREATED in 'partial_submissions'");
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
        this.saveLocalState();
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
        this.saveLocalState();
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
        this.saveLocalState();
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
        this.saveLocalState();
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
        this.state.reportDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

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

                // Save to persistent storage
                localStorage.setItem(`completed_report_${this.config.id}`, JSON.stringify(this.state));
                const btn = document.getElementById('show-previous-btn');
                if (btn) btn.style.display = 'block';

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

    handleShowPreviousReport() {
        const data = localStorage.getItem(`completed_report_${this.config.id}`);
        if (!data) return;

        this.showLoader();
        setTimeout(() => {
            try {
                const savedState = JSON.parse(data);
                this.state = savedState;
                this.renderResults();
                this.hideLoader();
                this.showStep(99); // Magic number for results
            } catch (e) {
                console.error("Error loading previous report:", e);
                this.hideLoader();
                this.showNonBlockingMessage("Could not load previous report.");
            }
        }, 2500);
    }

    renderResults() {
        // Version 3.5 - High Reliability Sync
        const lang = localStorage.getItem(`selected_lang_${this.config.id}`) || this.currentLanguage || 'en';
        console.log("Rendering results. Forced Sync Language:", lang);
        
        const langData = this.uiTranslations[lang];
        if (!langData) return;
        
        // Final sanity check: ensuring the engine's internal state matches the sync language
        this.currentLanguage = lang;
        this.updateStaticUI();
        this.updateLanguageToggle();

        // Dynamic result re-calculation
        if (typeof this.config.resultRules === 'function') {
             this.state.results = this.config.resultRules(this.state.healthScore, this.state.allAnswers, this.config, this.state.userInfo);
        }

        const userNameEl = document.getElementById('user-name');
        const userConcernEl = document.getElementById('user-concern');
        const reportDateEl = document.getElementById('report-date');
        const conditionTextEl = document.getElementById('condition-text');
        const issueHeaderEl = document.getElementById('issue-header');
        const conditionDetailsEl = document.getElementById('condition-details');

        const rawName = this.state.userInfo.name || "Patient";
        let displayName = rawName;
        // Proper Distinction: Switch content completely based on lang
        if (lang === 'hi') {
            const nameMap = { 
                'shivang': 'शिवांग', 'shivam': 'शिवम', 'rohit': 'रोहित', 
                'rahul': 'राहुल', 'deepak': 'दीपक', 'amit': 'अमित',
                'sanjay': 'संजय', 'vijay': 'विजय', 'ajay': 'अजय'
            };
            displayName = nameMap[rawName.toLowerCase().trim()] || rawName;
        } else {
            // Restore English Name if it was transliterated or matches a known Hindi string (reverse mapping if needed)
            const reverseMap = { 'शिवांग': 'Shivang', 'शिवम': 'Shivam' };
            displayName = reverseMap[rawName] || rawName;
        }

        if (userNameEl) userNameEl.innerText = displayName;

        // Populate Age and Category
        const userAgeEl = document.getElementById('user-age');
        const userCategoryEl = document.getElementById('user-category');
        
        if (userAgeEl && this.state.userInfo.dob) {
            const dob = new Date(this.state.userInfo.dob);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
            userAgeEl.innerText = age;
        }
        
        if (userCategoryEl) {
            const categoryMap = {
                'mens-wellness': "Men's Sexual Wellness",
                'womens-wellness': "Women's Wellness",
                'mens-weight': "Men's Weight Management",
                'womens-weight': "Women's Weight Management"
            };
            userCategoryEl.innerText = categoryMap[this.config.id] || this.config.title || "Health Assessment";
        }
        
        // Dynamic labels from results
        const displayIssueTitle = (lang === 'hi' && this.state.results.issueTitleHi) ? this.state.results.issueTitleHi : this.state.results.issueTitle;
        const displayConditionHTML = (lang === 'hi' && this.state.results.conditionTextHTMLHi) ? this.state.results.conditionTextHTMLHi : this.state.results.conditionTextHTML;

        if (userConcernEl) userConcernEl.innerText = displayIssueTitle;
        if (issueHeaderEl) issueHeaderEl.innerText = displayIssueTitle;
        if (conditionTextEl) conditionTextEl.innerHTML = displayConditionHTML;
        if (conditionDetailsEl) conditionDetailsEl.innerHTML = displayConditionHTML;

        if (reportDateEl) {
            const date = this.state.reportDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
            reportDateEl.innerText = date;
        }

        const riskLevelEl = document.getElementById('risk-level');
        if (riskLevelEl && typeof this.config.getRiskType === 'function') {
            const riskKey = this.config.getRiskType(this.state.healthScore);
            const riskTypeLabel = langData[riskKey] || riskKey;
            riskLevelEl.innerText = riskTypeLabel;
            riskLevelEl.style.color = this.getScoreColor(this.state.healthScore);
            console.log("Risk label updated to:", riskTypeLabel, "using key:", riskKey);
        }

        const riskContainer = document.getElementById('future-risk-tags');
        riskContainer.innerHTML = '';
        this.state.results.futureRisks.forEach((risk) => {
            const riskText = (lang === 'hi' && risk.hi) ? risk.hi : (risk.en || risk.text || risk);
            riskContainer.innerHTML += `<div class="risk-tag">${riskText}</div>`;
        });

        const mainTimelineTitle = document.querySelector('.results-timeline h3');
        const timelineContainer = document.getElementById('condition-timeline-container');
        timelineContainer.innerHTML = '';
        const timelineData = this.state.results.timelineData;

        if (mainTimelineTitle && langData['timeline-goal']) {
            mainTimelineTitle.innerHTML = langData['timeline-goal'];
        }

        const mergedTimeline = {};
        timelineData.general.forEach((item) => {
            if (!mergedTimeline[item.month]) {
                mergedTimeline[item.month] = { month: item.month, hi: item.hi, general: '', extras: [] };
            }
            mergedTimeline[item.month].general = (lang === 'hi' && item.hiDesc) ? item.hiDesc : item.timelineDesc;
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
            const displayMonth = (lang === 'hi' && data.hi) ? data.hi : data.month;
            timelineHTML += `
                <div class="month-box">
                    <div class="month-icon">
                        <img src="https://cdn.shopify.com/s/files/1/0924/5687/8383/files/timeline.webp?v=1774248748" alt="${displayMonth}" />
                    </div>
                    <h4>${displayMonth}</h4>
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
            const currencySymbol = langData['currency-symbol'] || 'Rs.';
            const oldPriceHTML = hasDiscount ? `<span class="old-price">${currencySymbol}${product.regularPrice}</span>` : '';
            productList.innerHTML += `
                <div class="product-card" data-action="open-product-modal" 
                    data-name="${product.name}" 
                    data-description="${product.description || ''}" 
                    data-price="${currencySymbol}${product.salePrice}" data-image="${product.image}">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="product-name">${product.name}</div>
                    <div class="price-section">
                        ${oldPriceHTML}
                        <span class="new-price">${currencySymbol}${product.salePrice}</span>
                    </div>
                </div>
            `;
            total += product.salePrice;
        });
        const finalCurrency = langData['currency-symbol'] || 'Rs.';
        document.getElementById('total-amount').textContent = finalCurrency + total;
        const floatingTotal = document.getElementById('floating-total-val');
        if (floatingTotal) floatingTotal.textContent = total;

        this.renderUGCContent();
        this.initDynamicHeightSync();
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

    persistData() {
        if (!this.state.partialDocId) return;
        const docRef = this.db.collection('partial_submissions').doc(this.state.partialDocId);
        const dataToSave = { ...this.state, lastUpdated: new Date() };
        console.log("Saving partial data:", this.state.partialDocId);

        delete dataToSave.config;
        delete dataToSave.results;
        delete dataToSave.healthScore;

        try {
            console.log("Attempting to update partial data for ID:", this.state.partialDocId);
            docRef.set(dataToSave, { merge: true });
            console.log("✅ Partial data SUCCESSFULLY UPDATED");
        } catch (e) {
            console.error('❌ Error persisting data:', e);
        }
    }

    saveLocalState() {
        try {
            const stateToSave = { ...this.state };
            // Ensure we don't save massive config objects
            delete stateToSave.config;
            localStorage.setItem(`active_session_state_${this.config.id}`, JSON.stringify(stateToSave));
            
            // Also check for legacy "previous report" button
            const prevReport = localStorage.getItem(`completed_report_${this.config.id}`);
            const btn = document.getElementById('show-previous-btn');
            if (prevReport && btn) btn.style.display = 'block';
        } catch (e) {
            console.error("Error saving local state:", e);
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
        const reviewsTitle = this.uiTranslations[this.currentLanguage]['reviews-title'] || "Customer Reviews";
        ugcContainer.innerHTML = `
            <h3 data-i18n="reviews-title">${reviewsTitle}</h3>
            <div class="ugc-slider">
                ${['68SbZuINym0', 'EyvZLDLxFYU', 'i_lfAg9o4HA'].map(id => `
                    <div class="ugc-slide ugc-slide-lite" data-action="load-youtube" data-src="https://www.youtube.com/embed/${id}">
                        <img class="ugc-thumbnail" 
                             src="https://i.ytimg.com/vi/${id}/maxresdefault.jpg" 
                             onerror="this.src='https://i.ytimg.com/vi/${id}/hqdefault.jpg'"
                             alt="Review" loading="lazy">
                        <div class="play-button">
                            <svg viewBox="0 0 24 24" fill="white" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        ugcContainer.style.display = 'block';
    }

    loadYoutubeVideo(target) {
        const slide = target.closest('.ugc-slide-lite');
        if (!slide || !slide.dataset.src) return;

        // 1. Optimized Initialization: Clear any other active videos first
        document.querySelectorAll('.ugc-slide:not(.ugc-slide-lite)').forEach(activeSlide => {
            const activeIframe = activeSlide.querySelector('iframe');
            if (activeIframe) activeIframe.remove();
            
            // Restore play icon and original state
            activeSlide.classList.add('ugc-slide-lite');
            const newPlayBtn = document.createElement('div');
            newPlayBtn.className = 'play-button';
            newPlayBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="white" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>
            `;
            activeSlide.appendChild(newPlayBtn);
            
            const existingThumb = activeSlide.querySelector('.ugc-thumbnail');
            if (existingThumb) {
                existingThumb.style.display = 'block';
                existingThumb.style.opacity = '1';
            }
        });

        // 2. Immediate Visual Feedback
        slide.classList.remove('ugc-slide-lite');
        const playBtn = slide.querySelector('.play-button');
        if (playBtn) playBtn.remove();
        
        const thumbnail = slide.querySelector('.ugc-thumbnail');
        if (thumbnail) thumbnail.style.opacity = '0';

        const loader = document.createElement('div');
        loader.className = 'ugc-loader';
        slide.appendChild(loader);

        // 3. Native YouTube Shorts-style Embed
        // controls=1 (native), iv_load_policy=3 (no annotations), modestbranding=1 (premium)
        // enablejsapi=1 for state tracking
        const iframe = document.createElement('iframe');
        iframe.src = `${slide.dataset.src}?autoplay=1&mute=0&rel=0&modestbranding=1&controls=1&iv_load_policy=3&enablejsapi=1`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.style.cssText = 'width:100%; height:100%; position:absolute; top:0; left:0; border:none; z-index:1; opacity:0; transition:opacity 0.4s;';
        
        // 4. Advanced State Management (Hides thumbnail ONLY when playing)
        const checkPlaying = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.event === 'onStateChange' && data.info === 1) { // 1 = Playing
                    if (loader) loader.remove();
                    if (thumbnail) {
                        thumbnail.style.opacity = '0';
                        setTimeout(() => { thumbnail.style.display = 'none'; }, 400);
                    }
                    iframe.style.opacity = '1';
                    window.removeEventListener('message', checkPlaying);
                }
            } catch (err) {}
        };
        window.addEventListener('message', checkPlaying);
        
        // 4. Remove all custom click-pause/volume logic
        slide.onclick = null; 
        
        iframe.onload = () => {
            if (loader) loader.remove();
            if (thumbnail) thumbnail.style.display = 'none';
            iframe.style.opacity = '1';
        };

        slide.appendChild(iframe);
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
            progressValue.innerHTML = `<span class="score-num">${currentScore}</span>`;
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
        const redirectText = this.uiTranslations[this.currentLanguage]['redirecting'] || 'Redirecting...';
        buyButton.innerText = redirectText;
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
        if (!modal) return;

        // Sync translations for the modal
        this.updateStaticUI(modal);

        this.enteredPhone = this.state.userInfo.phone || "";
        const phoneInput = document.getElementById("otp-phone");
        if (phoneInput) phoneInput.value = this.enteredPhone;
        
        document.getElementById("otp-step-1").style.display = "block";
        document.getElementById("otp-step-2").style.display = "none";
        const warning = document.getElementById("phone-warning");
        if (warning) warning.style.display = "none";

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
        const warning = document.getElementById("phone-warning");
        
        if (!/^\d{10}$/.test(phone)) {
            if (warning) warning.style.display = "block";
            return;
        }
        if (warning) warning.style.display = "none";

        this.enteredPhone = phone;
        
        // Instant Switch for better UX
        document.getElementById("otp-step-1").style.display = "none";
        document.getElementById("otp-step-2").style.display = "block";
        this.startOtpTimer();

        // Background call
        fetch("https://generateotp-xrtgefpbxq-em.a.run.app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
        }).catch(err => {
            console.error("OTP send error:", err);
            // Optionally revert UI if it fails completely, 
            // but usually we want to stay in step 2 to allow "Resend"
        });
    }

    startOtpTimer() {
        this.otpExpiresAt = Date.now() + 60000;
        const resendLink = document.getElementById("resend-link");
        const timerText = document.getElementById("otp-timer");
        
        if (resendLink) resendLink.style.display = "none";
        if (timerText) timerText.style.display = "inline";

        clearInterval(this.otpTimer);
        this.otpTimer = setInterval(() => {
            const timeLeft = Math.max(0, Math.floor((this.otpExpiresAt - Date.now()) / 1000));
            if (timerText) timerText.innerText = `(${timeLeft}s)`;
            
            if (timeLeft <= 0) {
                clearInterval(this.otpTimer);
                if (resendLink) resendLink.style.display = "inline";
                if (timerText) timerText.style.display = "none";
            }
        }, 1000);
    }

    async verifyOtpFromInputs() {
        const digits = Array.from(document.querySelectorAll(".otp-input-group input")).map(i => i.value).join("");
        if (digits.length < 6) return;

        const verifyBtn = document.querySelector('[data-action="verify-otp"]');
        if (verifyBtn) {
            verifyBtn.disabled = true;
            const verifyingText = this.uiTranslations[this.currentLanguage]['verifying'] || 'Verifying...';
            verifyBtn.innerText = verifyingText;
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
                    this.state.userInfo.phone = verifiedPhone;
                    if (this.state.finalDocId) {
                        const docRef = this.db.collection('questionnaire_submissions').doc(this.state.finalDocId);
                        await docRef.update({
                            phone: verifiedPhone,
                            "rawState.userInfo.phone": verifiedPhone
                        });
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

    initDynamicHeightSync() {
        const leftColumn = document.querySelector('.left-column');
        const productList = document.getElementById('product-list');
        const rightContainer = document.querySelector('.recommended-treatment');
        const checkoutSection = document.querySelector('.checkout-section');
        const floatingBar = document.getElementById('floating-checkout-bar');
        const header = rightContainer ? rightContainer.querySelector('h3') : null;

        if (!leftColumn || !productList || !rightContainer) return;

        const syncHeight = () => {
            const leftHeight = leftColumn.offsetHeight;
            const headerHeight = header ? header.offsetHeight : 0;
            const checkoutHeight = checkoutSection ? checkoutSection.offsetHeight : 0;
            
            // Calculate available space for the product list
            const availableHeight = leftHeight - headerHeight - checkoutHeight - 80;
            
            if (availableHeight > 200) {
                productList.style.maxHeight = `${availableHeight}px`;
            } else {
                productList.style.maxHeight = '480px'; 
            }
        };

        // Resize Observer for Dynamic Height
        const resObserver = new ResizeObserver(() => {
            requestAnimationFrame(syncHeight);
        });
        if (leftColumn) resObserver.observe(leftColumn);
        syncHeight();
    }

    showNonBlockingMessage(msg) {
        console.log("Message:", msg);
        // Fallback to simple alert or a toast if needed
        alert(msg);
    }
}

// Initialization logic
document.addEventListener('DOMContentLoaded', () => {
    if (typeof questionnaireConfig !== 'undefined' && typeof window.db !== 'undefined') {
        window.myQuestionnaire = new QuestionnaireEngine(questionnaireConfig);
    }
});
