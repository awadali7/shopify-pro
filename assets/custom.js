const CONSTANTS = {
    SPIN_DURATION: 5000,
    MOBILE_BREAKPOINT: 640,
    CANVAS_SIZES: {
        MOBILE: 260,
        DESKTOP: 300,
    },
    FONT_SIZES: {
        MOBILE: 12,
        DESKTOP: 14,
    },
    TEXT_LIMITS: {
        MOBILE: 10,
        DESKTOP: 15,
    },
    SPIN_MULTIPLIER: 5,
    HOURS_BETWEEN_SPINS: 24,
};

const state = {
    wheelSpinner: null,
    isSpinning: false,
    currentRotation: 0,
    luckyDrawProducts: [],
    discountCodes: [],
};

const utils = {
    truncateText: (text, maxLength) =>
        text.length > maxLength
            ? `${text.substring(0, maxLength - 3)}...`
            : text,

    easeOut: (t) => 1 - Math.pow(1 - t, 3),
};

const shopifyConfig = {
    shopName: "https://pro-backend-chi.vercel.app",
    apiVersion: "2024-10",
};

class ProductAPI {
    static async getLuckyDrawProducts() {
        try {
            const response = await fetch(
                `${shopifyConfig.shopName}/api/collection-products/`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch Lucky Draw products");
            }

            const data = await response.json();
            console.log(data.data, "data");

            state.luckyDrawProducts = data.data.map((product) => ({
                title: product.title,
                id: product.id,
                code: product.title,
                value: product?.value ? product.value : "",
                product_type: product?.admin_graphql_api_id.includes(
                    "Metafield"
                )
                    ? "metafield"
                    : "product",
                image: product?.image?.src
                    ? product.image?.src
                    : "https://cdn.shopify.com/s/files/1/0663/9668/4469/files/rb_3649.png?v=1732672851",
            }));

            return state.luckyDrawProducts;
        } catch (error) {
            console.error("Error fetching Lucky Draw products:", error);
            throw error;
        }
    }
}

class EnhancedLuckyWheel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.prizes = this.initializePrizes();
        this.resizeHandler = this.handleResize.bind(this);
        this.loadedImages = new Map();
        this.offscreenCanvas = document.createElement("canvas");
        this.offscreenCtx = this.offscreenCanvas.getContext("2d");
        this.initialize();
    }

    initializePrizes() {
        if (state.luckyDrawProducts && state.luckyDrawProducts.length > 0) {
            return state.luckyDrawProducts.map((product, index) => {
                const imageUrl = product.image || product?.image?.src || "";

                return {
                    label: product.title,
                    image: imageUrl,
                    id: product.id,
                    value: product.value,
                    code: product.code,
                    product_type: product.product_type,
                    bgColor: index % 2 === 0 ? "#BFB3F7" : "#F5DCAC",
                    probability: 100 / state.luckyDrawProducts.length,
                };
            });
        }
        return [];
    }

    async preloadImages() {
        const loadPromises = this.prizes
            .filter((prize) => prize.image)
            .map((prize) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => {
                        const canvas = document.createElement("canvas");
                        const ctx = canvas.getContext("2d");
                        const size = 200;
                        canvas.width = size;
                        canvas.height = size;

                        const scale = Math.max(
                            size / img.width,
                            size / img.height
                        );
                        const scaledWidth = img.width * scale;
                        const scaledHeight = img.height * scale;

                        const offsetX = (size - scaledWidth) / 2;
                        const offsetY = (size - scaledHeight) / 2;

                        ctx.clearRect(0, 0, size, size);
                        ctx.drawImage(
                            img,
                            offsetX,
                            offsetY,
                            scaledWidth,
                            scaledHeight
                        );

                        const processedImg = new Image();
                        processedImg.src = canvas.toDataURL();
                        resolve({ id: prize.id, img: processedImg });
                    };
                    img.onerror = () => resolve(null);
                    img.src = prize.image;
                });
            });

        const loadedImages = await Promise.allSettled(loadPromises);
        loadedImages.forEach((result) => {
            if (result.status === "fulfilled" && result.value) {
                this.loadedImages.set(result.value.id, result.value.img);
            }
        });
    }

    async initialize() {
        this.updateCanvasSize();
        await this.preloadImages();
        this.drawWheel();
        window.addEventListener("resize", this.resizeHandler);
    }

    handleResize() {
        this.updateCanvasSize();
        this.drawWheel();
    }

    updateCanvasSize() {
        const size =
            window.innerWidth <= CONSTANTS.MOBILE_BREAKPOINT
                ? CONSTANTS.CANVAS_SIZES.MOBILE
                : CONSTANTS.CANVAS_SIZES.DESKTOP;
        this.canvas.width = size;
        this.canvas.height = size;
        this.offscreenCanvas.width = size;
        this.offscreenCanvas.height = size;
    }

    drawWheel() {
        const offscreenCtx = this.offscreenCtx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        const totalSegments = this.prizes.length;
        const arcAngle = (2 * Math.PI) / totalSegments;

        offscreenCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const fontSize =
            window.innerWidth <= CONSTANTS.MOBILE_BREAKPOINT
                ? CONSTANTS.FONT_SIZES.MOBILE
                : CONSTANTS.FONT_SIZES.DESKTOP;

        const maxTextLength =
            window.innerWidth <= CONSTANTS.MOBILE_BREAKPOINT
                ? CONSTANTS.TEXT_LIMITS.MOBILE
                : CONSTANTS.TEXT_LIMITS.DESKTOP;

        this.prizes.forEach((prize, index) => {
            const startAngle = index * arcAngle;
            const endAngle = startAngle + arcAngle;

            offscreenCtx.beginPath();
            offscreenCtx.moveTo(centerX, centerY);
            offscreenCtx.arc(centerX, centerY, radius, startAngle, endAngle);
            offscreenCtx.fillStyle = prize.bgColor;
            offscreenCtx.fill();

            offscreenCtx.save();

            const truncatedTitle = utils.truncateText(
                prize.label,
                maxTextLength
            );

            offscreenCtx.font = `bold ${fontSize}px Arial`;
            offscreenCtx.fillStyle = "black";

            const midAngle = startAngle + arcAngle / 2;
            const textRadius = radius * 0.8;
            const textX = centerX + textRadius * Math.cos(midAngle);
            const textY = centerY + textRadius * Math.sin(midAngle);

            const textWidth = offscreenCtx.measureText(truncatedTitle).width;

            offscreenCtx.save();
            offscreenCtx.translate(textX, textY);
            offscreenCtx.rotate(midAngle + Math.PI / 2);

            const shouldFlip =
                midAngle > Math.PI / 2 && midAngle < (3 * Math.PI) / 2;
            if (shouldFlip) {
                offscreenCtx.rotate(Math.PI);
            }

            offscreenCtx.textAlign = "center";
            offscreenCtx.textBaseline = "middle";
            offscreenCtx.fillText(truncatedTitle, 0, 0);

            offscreenCtx.restore();
            offscreenCtx.restore();

            offscreenCtx.save();
            offscreenCtx.translate(centerX, centerY);
            offscreenCtx.rotate(startAngle + arcAngle / 2);

            const imageSize = radius * 0.4;
            const imageDistance = radius * 0.5;

            const img = this.loadedImages.get(prize.id);
            if (img) {
                offscreenCtx.save();
                offscreenCtx.beginPath();
                offscreenCtx.arc(
                    imageDistance,
                    0,
                    imageSize / 2,
                    0,
                    Math.PI * 2
                );
                offscreenCtx.clip();
                offscreenCtx.drawImage(
                    img,
                    imageDistance - imageSize / 2,
                    -imageSize / 2,
                    imageSize,
                    imageSize
                );
                offscreenCtx.restore();
            }

            offscreenCtx.restore();
        });

        this.drawIndicator(centerX, centerY - radius);

        // Transfer offscreen canvas to main canvas
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }

    drawIndicator(x, y) {
        const ctx = this.offscreenCtx;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 8, y - 12);
        ctx.lineTo(x + 8, y - 12);
        ctx.closePath();
        ctx.fillStyle = "#FF4500";
        ctx.fill();
    }

    async spin() {
        if (state.isSpinning) return;
        state.isSpinning = true;

        const spinButton = document.querySelector(".start-spin");
        spinButton.disabled = true;
        spinButton.style.opacity = "0.5";

        const selectedPrizeIndex = this.selectPrize();
        const segmentAngle = 360 / this.prizes.length;
        const segmentOffset = Math.random() * segmentAngle;
        const prizeRotation = selectedPrizeIndex * segmentAngle + segmentOffset;
        const totalRotation = CONSTANTS.SPIN_MULTIPLIER * 540 + prizeRotation;

        await this.animateWheel(totalRotation);
        state.isSpinning = false;

        const winningPrizeIndex = this.getWinningPrizeIndex();
        console.log("Selected Prize Index:", selectedPrizeIndex);
        console.log("Winning Prize Index:", winningPrizeIndex);
        console.log("Winning Prize:", this.prizes[winningPrizeIndex]);

        this.showPrizeNotification(this.prizes[winningPrizeIndex]);

        spinButton.disabled = false;
        spinButton.style.opacity = "1";
    }

    getWinningPrizeIndex() {
        const segmentAngle = 360 / this.prizes.length;
        const normalizedRotation = ((state.currentRotation % 360) + 360) % 360;
        const adjustedRotation = (360 - normalizedRotation + 270) % 360;
        const index = Math.floor(adjustedRotation / segmentAngle);
        return index % this.prizes.length;
    }

    selectPrize() {
        let random = Math.random() * 100;
        let cumulativeProbability = 0;

        return this.prizes.findIndex((prize) => {
            cumulativeProbability += prize.probability;
            return random <= cumulativeProbability;
        });
    }

    async animateWheel(targetRotation) {
        return new Promise((resolve) => {
            const startRotation = state.currentRotation;
            const startTime = performance.now();

            const customEasing = (t) => {
                return 1 - Math.pow(1 - t, 4);
            };

            const animateFrame = (currentTime) => {
                const elapsed = currentTime - startTime;
                const duration = CONSTANTS.SPIN_DURATION * 1.5;
                const progress = Math.min(elapsed / duration, 1);

                state.currentRotation =
                    startRotation + targetRotation * customEasing(progress);

                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

                this.ctx.save();
                this.ctx.translate(
                    this.canvas.width / 2,
                    this.canvas.height / 2
                );
                this.ctx.rotate((state.currentRotation * Math.PI) / 180);
                this.ctx.translate(
                    -this.canvas.width / 2,
                    -this.canvas.height / 2
                );

                this.drawWheel();
                this.ctx.restore();

                if (progress < 1) {
                    requestAnimationFrame(animateFrame);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animateFrame);
        });
    }

    showPrizeNotification(prize) {
        console.log(prize, "prize =====>");

        const modalContent = document.querySelector(".promo-modal-content");
        const spinElements = document.querySelectorAll(
            ".promo-spin-left, .promo-spin-right"
        );

        modalContent.innerHTML = `
        <div class="prize-result-container">
            <h2 class="prize-title">Congratulations! 🎉</h2>
            <div class="prize-details">
                <h3>You've Won:</h3>
                <div class="prize-image-spin">
                <img src="${prize.image}" alt="${prize.label}" width="300" height="300" />
                </div>

                <div class="prize-value">${prize.label}</div>
                <div class="prize-code-container">
                   ${prize.product_type !== "product" ? `Voucher Code: ${prize.code}` : ""} 
                </div>
                <button class="claim-prize-btn" data-prize-type="${prize.product_type}" data-prize-id="${prize.id}" data-prize-code="${prize.code}">
                    ${prize.product_type === "product" ? "Add to Cart" : "Copy Code"}
                </button>
            </div>
        </div>
        `;

        spinElements.forEach((el) => (el.style.display = "none"));
        modalContent.classList.remove("promo-modal-content");

        // Add event listener for the claim button
        const claimButton = document.querySelector(".claim-prize-btn");
        claimButton.addEventListener("click", this.handleClaimPrize.bind(this));
    }

    handleClaimPrize(event) {
        const prizeType = event.target.dataset.prizeType;
        const variantId = event.target.dataset.variantId;
        const prizeCode = event.target.dataset.prizeCode;

        if (prizeType === "product") {
            this.addToCart(variantId);
        } else {
            this.copyVoucherCode(prizeCode);
        }
    }

    async addToCart(variantId) {
        // Ensure variantId is a number
        const parsedVariantId = parseInt(variantId, 10);

        if (!parsedVariantId) {
            console.error("Invalid variant ID:", variantId);
            alert("Sorry, could not add product to cart. Invalid product.");
            return;
        }

        try {
            // Method 1: Standard Shopify cart add
            const formData = new FormData();
            formData.append("id", parsedVariantId);
            formData.append("quantity", 1);

            const response = await fetch("/cart/add", {
                method: "POST",
                body: formData,
            });

            // If fetch fails, fall back to direct URL method
            if (!response.ok) {
                console.error("Cart add fetch failed, trying URL redirect");
                window.location.href = `/cart/add?id=${parsedVariantId}&quantity=1`;
                return;
            }

            // Redirect to cart or open cart drawer
            window.location.href = "/cart";
        } catch (error) {
            console.error("Comprehensive Cart Add Error:", error);

            try {
                // Fallback method
                window.location.href = `/cart/add?id=${parsedVariantId}&quantity=1`;
            } catch (fallbackError) {
                console.error("Fallback cart add failed:", fallbackError);
                alert(
                    "Sorry, we couldn't add the product to your cart. Please try again or contact support."
                );
            }
        }
    }

    copyVoucherCode(code) {
        // Create a temporary textarea to copy the code
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = code;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();

        try {
            // Execute the copy command
            document.execCommand("copy");
        } catch (err) {
            console.error("Unable to copy code:", err);
        }

        // Remove the temporary textarea
        document.body.removeChild(tempTextArea);
    }

    destroy() {
        window.removeEventListener("resize", this.resizeHandler);
    }
}

// LocalStorage manager
class StorageManager {
    static checkPreviousSpin() {
        try {
            const lastSpin = localStorage.getItem("lastWonPrize");
            if (lastSpin) {
                const spinData = JSON.parse(lastSpin);
                const spinTime = new Date(spinData.timestamp);
                const now = new Date();
                const hoursSinceLastSpin = (now - spinTime) / (1000 * 60 * 60);

                return hoursSinceLastSpin >= CONSTANTS.HOURS_BETWEEN_SPINS;
            }
            return true;
        } catch (error) {
            console.error("Error checking previous spin:", error);
            return true;
        }
    }
}

// Event handlers
class EventHandlers {
    static initializeEmailValidation() {
        const emailInput = document.getElementById("emailInput");
        const spinButton = document.querySelector(".start-spin");

        emailInput.addEventListener("input", () => {
            const isValid = emailInput.checkValidity();
            spinButton.disabled = !isValid;
            spinButton.style.opacity = isValid ? "1" : "0.5";
        });
    }

    static setupModalHandlers() {
        const giftBox = document.querySelector(".gift-box");
        const closeButton = document.querySelector(".close-modal");
        const promoModal = document.getElementById("promoModal");
        const emailForm = document.getElementById("emailForm");

        emailForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const emailInput = document.querySelector("#emailInput");
            const email = emailInput.value.trim();

            if (!email) {
                alert("Please enter a valid email.");
                return;
            }

            try {
                const response = await fetch("/save-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });

                const result = await response.json();

                if (response.ok) {
                    alert("Email saved successfully!");
                } else {
                    console.error("Error:", result.error);
                    alert("Failed to save email.");
                }
            } catch (error) {
                console.error("Network error:", error);
                alert("An error occurred. Please try again later.");
            }

            if (email && state.wheelSpinner) {
                state.wheelSpinner();
            }
        });
        // Trigger wheel spin

        giftBox.addEventListener("click", () => {
            promoModal.style.display = "flex";
            document.body.classList.add("modal-open-spin"); // Prevent background scroll
            const wheel = new LuckyWheel("wheelCanvas");
            state.wheelSpinner = () => wheel.spin();
        });

        closeButton.addEventListener("click", () => {
            promoModal.style.display = "none";
            document.body.classList.remove("modal-open-spin"); // Re-enable background scroll
        });

        emailForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("emailInput").value;
            if (email && state.wheelSpinner) {
                state.wheelSpinner();
            }
        });

        promoModal.addEventListener("click", (e) => {
            if (e.target === promoModal) {
                promoModal.style.display = "none";
                document.body.classList.remove("modal-open-spin");
            }
        });
    }
}

async function createOrUpdateCustomer(email) {
    try {
        const response = await fetch(
            `${shopifyConfig.shopName}/api/customers`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Add authentication token
                },
                body: JSON.stringify({
                    customer: {
                        email: email,
                        first_name: "Lucky Wheel",
                        tags: ["lucky_wheel_signup"],
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error("Failed to create/update customer");
        }

        const result = await response.json();
        console.log("Customer processed", result);
    } catch (error) {
        console.error("Error processing customer:", error);
    }
}

// Initialize application
async function initializeApp() {
    try {
        // First try to fetch products from the API
        try {
            const products = await ProductAPI.getLuckyDrawProducts();
            console.log("Products loaded from API:", products);
        } catch (apiError) {
            console.error(
                "Failed to load products from API, falling back to default prizes:",
                apiError
            );
        }

        // Set up event handlers when DOM is ready
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                EventHandlers.initializeEmailValidation();
                EventHandlers.setupModalHandlers();
            });
        } else {
            // DOM is already ready
            EventHandlers.initializeEmailValidation();
            EventHandlers.setupModalHandlers();
        }
    } catch (error) {
        console.error("Error initializing application:", error);
    }
}

// Start the application
initializeApp();
