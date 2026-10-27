import cv2
import numpy as np
from PIL import Image

def detect_cards(image_path):
    img = cv2.imread(image_path)
    h, w, _ = img.shape
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # In Telegram, the card has a border or different brightness from the page background.
    # Page background is around RGB(14, 22, 28) -> Gray ~20-25
    # Card background is around RGB(26, 42, 50) -> Gray ~38-42
    print(f"File: {image_path}, Dimensions: {w}x{h}")
    print("Corner pixel (0,0):", img[0, 0].tolist(), "Center of card (50, 50):", img[50, 50].tolist())
    
    # Binary mask of card background or brighter
    # Background between cards is darker than cards
    bg_val = np.median(img[0:10, 0:10])
    print("Background val:", bg_val)

detect_cards(r"c:\Users\pc\Desktop\фотодлябота\Снимок экрана 2026-10-27 174044.png")
