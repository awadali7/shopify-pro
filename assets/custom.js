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

// State management
const state = {
    wheelSpinner: null,
    isSpinning: false,
    currentRotation: 0,
    luckyDrawProducts: [],
    discountCodes: [],
};

// Utility functions
const utils = {
    truncateText: (text, maxLength) =>
        text.length > maxLength
            ? `${text.substring(0, maxLength - 3)}...`
            : text,

    easeOut: (t) => 1 - Math.pow(1 - t, 3),
};

const shopifyConfig = {
    shopName: "https://pro-backend-chi.vercel.app",
    apiVersion: "2024-10", // Current API version
};

// API functions
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

            // Transform the data to match the expected format
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

// Wheel drawing logic
class LuckyWheel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.prizes = this.initializePrizes();
        this.resizeHandler = this.handleResize.bind(this);
        this.loadedImages = new Map();
        this.initialize();
    }

    initializePrizes() {
        if (state.luckyDrawProducts && state.luckyDrawProducts.length > 0) {
            return state.luckyDrawProducts.map((product, index) => {
                // Normalize image URL extraction
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
        return []; // Return empty array if no products
    }

    async preloadImages() {
        const loadImage = (url) => {
            return new Promise((resolve, reject) => {
                if (!url) {
                    console.warn("No image URL provided");
                    resolve(null);
                    return;
                }
                const img = new Image();
                img.crossOrigin = "Anonymous"; // Helps with CORS issues
                img.onload = () => {
                    // Create a canvas to ensure image is properly loaded and scaled
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");

                    // Set canvas size to a standard square
                    const size = 200;
                    canvas.width = size;
                    canvas.height = size;

                    // Calculate scaling to fit the image while maintaining aspect ratio
                    const scale = Math.max(size / img.width, size / img.height);
                    const scaledWidth = img.width * scale;
                    const scaledHeight = img.height * scale;

                    // Center the image on the canvas
                    const offsetX = (size - scaledWidth) / 2;
                    const offsetY = (size - scaledHeight) / 2;

                    // Clear and draw the scaled image
                    ctx.clearRect(0, 0, size, size);
                    ctx.drawImage(
                        img,
                        offsetX,
                        offsetY,
                        scaledWidth,
                        scaledHeight
                    );

                    // Convert to image and resolve
                    const processedImg = new Image();
                    processedImg.src = canvas.toDataURL();
                    resolve(processedImg);
                };
                img.onerror = (error) => {
                    console.error(`Failed to load image: ${url}`, error);
                    resolve(null);
                };
                img.src = url;
            });
        };

        for (const prize of this.prizes) {
            if (prize.image) {
                try {
                    const img = await loadImage(prize.image);
                    if (img) {
                        this.loadedImages.set(prize.id, img);
                    }
                } catch (error) {
                    console.error(
                        `Error processing image for prize ${prize.id}:`,
                        error
                    );
                }
            }
        }
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
    }

    drawWheel() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        const totalSegments = this.prizes.length;
        const arcAngle = (2 * Math.PI) / totalSegments;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Set default font styles
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

            // Draw segment
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            this.ctx.fillStyle = prize.bgColor;
            this.ctx.fill();

            // Prepare for text placement
            this.ctx.save();

            // Truncate text if it's too long
            const truncatedTitle = utils.truncateText(
                prize.label,
                maxTextLength
            );

            // Set text properties
            this.ctx.font = `bold ${fontSize}px Arial`;
            this.ctx.fillStyle = "black";

            // Calculate mid-angle of the segment
            const midAngle = startAngle + arcAngle / 2;

            // Calculate text position
            const textRadius = radius * 0.8;
            const textX = centerX + textRadius * Math.cos(midAngle);
            const textY = centerY + textRadius * Math.sin(midAngle);

            // Measure text width for better positioning
            const textWidth = this.ctx.measureText(truncatedTitle).width;

            // Adjust text rotation and alignment
            this.ctx.save();
            this.ctx.translate(textX, textY);
            this.ctx.rotate(midAngle + Math.PI / 2);

            // Determine if text should be flipped
            const shouldFlip =
                midAngle > Math.PI / 2 && midAngle < (3 * Math.PI) / 2;
            if (shouldFlip) {
                this.ctx.rotate(Math.PI);
            }

            // Draw text centered
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(truncatedTitle, 0, 0);

            // Restore canvas state
            this.ctx.restore();
            this.ctx.restore();

            // Image drawing logic
            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(startAngle + arcAngle / 2);

            const imageSize = radius * 0.4;
            const imageDistance = radius * 0.5;

            const img = this.loadedImages.get(prize.id);
            if (img) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(imageDistance, 0, imageSize / 2, 0, Math.PI * 2);
                this.ctx.clip();
                this.ctx.drawImage(
                    img,
                    imageDistance - imageSize / 2,
                    -imageSize / 2,
                    imageSize,
                    imageSize
                );
                this.ctx.restore();
            }

            this.ctx.restore();
        });

        this.drawIndicator(centerX, centerY - radius);
    }

    drawIndicator(x, y) {
        // More subtle indicator
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x - 8, y - 12);
        this.ctx.lineTo(x + 8, y - 12);
        this.ctx.closePath();
        this.ctx.fillStyle = "#FF4500"; // Vibrant red
        this.ctx.fill();
    }

    async spin() {
        if (state.isSpinning) return;
        state.isSpinning = true;

        const spinButton = document.querySelector(".start-spin");
        spinButton.disabled = true;
        spinButton.style.opacity = "0.5";

        // Select a prize with weighted probability
        const selectedPrizeIndex = this.selectPrize();
        const segmentAngle = 360 / this.prizes.length;

        // Randomize the exact position within the selected segment
        const segmentOffset = Math.random() * segmentAngle;
        const prizeRotation = selectedPrizeIndex * segmentAngle + segmentOffset;

        // Increase spin multiplier for more rotations
        const totalRotation = CONSTANTS.SPIN_MULTIPLIER * 540 + prizeRotation;

        await this.animateWheel(totalRotation);
        state.isSpinning = false;

        // Get the winning prize index after rotation
        const winningPrizeIndex = this.getWinningPrizeIndex();
        console.log("Selected Prize Index:", selectedPrizeIndex);
        console.log("Winning Prize Index:", winningPrizeIndex);
        console.log("Winning Prize:", this.prizes[winningPrizeIndex]);

        this.showPrizeNotification(this.prizes[winningPrizeIndex]);

        // Re-enable spin button
        spinButton.disabled = false;
        spinButton.style.opacity = "1";
    }

    getWinningPrizeIndex() {
        const segmentAngle = 360 / this.prizes.length;

        // Normalize the current rotation to be between 0 and 360 degrees
        const normalizedRotation = ((state.currentRotation % 360) + 360) % 360;

        // Adjust the rotation to account for the pointer's position
        const adjustedRotation = (360 - normalizedRotation + 270) % 360;

        // Calculate the index based on the adjusted rotation
        const index = Math.floor(adjustedRotation / segmentAngle);

        // Ensure the index is within the prizes array bounds
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
        const startRotation = state.currentRotation;
        const startTime = performance.now();

        // More advanced easing function for smoother animation
        const easeInOutCubic = (t) => {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(
                elapsed / (CONSTANTS.SPIN_DURATION * 1.5),
                1
            );

            // Use the more sophisticated easing function
            state.currentRotation =
                startRotation + targetRotation * easeInOutCubic(progress);

            this.ctx.save();
            this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.rotate((state.currentRotation * Math.PI) / 180);
            this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
            this.drawWheel();
            this.ctx.restore();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        return new Promise((resolve) => {
            requestAnimationFrame(function tick(currentTime) {
                animate(currentTime);
                if (state.currentRotation >= targetRotation) resolve();
                else requestAnimationFrame(tick);
            });
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