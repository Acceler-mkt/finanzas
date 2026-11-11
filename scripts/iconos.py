"""Genera los iconos de la app (marca de Acceler sobre fondo oscuro). Uso: python scripts/iconos.py"""
from pathlib import Path
from PIL import Image, ImageDraw

FONDO = "#0c0b0a"
# Los cinco círculos del logo de Acceler (coordenadas del SVG original)
CIRCULOS = [(60, 72, 54, "#7a2a2a"), (76, 56, 44, "#e8a048"), (68, 66, 36, "#c24a4a"), (78, 60, 26, "#de6262"), (84, 56, 15, "#f1b76f")]
CENTRO = (63, 69)
ANCHO_MARCA = 114

def icono(lado: int, ocupa: float) -> Image.Image:
    s = 4  # se dibuja a 4x y se reduce para suavizar los bordes
    img = Image.new("RGB", (lado * s, lado * s), FONDO)
    d = ImageDraw.Draw(img)
    escala = lado * s * ocupa / ANCHO_MARCA
    for cx, cy, r, color in CIRCULOS:
        x = lado * s / 2 + (cx - CENTRO[0]) * escala
        y = lado * s / 2 + (cy - CENTRO[1]) * escala
        d.ellipse([x - r * escala, y - r * escala, x + r * escala, y + r * escala], fill=color)
    return img.resize((lado, lado), Image.LANCZOS)

salida = Path(__file__).resolve().parent.parent / "public" / "icons"
salida.mkdir(parents=True, exist_ok=True)
icono(192, 0.62).save(salida / "icono-192.png")
icono(512, 0.62).save(salida / "icono-512.png")
icono(180, 0.62).save(salida / "icono-180.png")
icono(512, 0.46).save(salida / "icono-maskable-512.png")  # con margen: el sistema lo recorta en círculo
print("Iconos en", salida)
