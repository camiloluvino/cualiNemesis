# Sintaxis de Codificación Cualitativa (QUALITATIVE_SYNTAX)

El plugin procesa la información en base a convenciones específicas de escritura dentro de Roam Research. La IA y la lógica del sistema deben esperar y respetar las siguientes estructuras:

## 1. Nomenclatura de Códigos (Namespaces)
Los códigos analíticos se definen como enlaces a páginas que contienen prefijos jerárquicos separados por `/`. 
- **Formato esperado:** `[[prefijo/categoría/subcategoría]]`
- **Ejemplos:** `[[cod/norm/invertir de manera equivalente]]`, `[[tema/migración/redes de apoyo]]`.
- **Regla de Extracción:** El sistema busca expresiones regulares que capturen contenido entre corchetes dobles `[[...]]` que contengan al menos un carácter `/`.

## 2. Estructura del Dato Cualitativo (Citas)
- **Unidad de análisis:** El bloque de texto de Roam (identificado por su UID).
- Se considera que un bloque está "codificado" cuando la etiqueta del código `[[...]]` está presente en el string (texto) del mismo bloque.

## 3. Output Estructural (Consolidación)
Al extraer y consolidar los datos, la jerarquía visual generada obligatoria es:
1. Bloque padre: Nombre completo del código `[[prefijo/categoría]]`.
2. Bloques hijos (anidados con tabulación): Referencias directas al bloque de la cita `((UID))`.

*Formato portapapeles esperado:*
```text
[[cod/norm/ser transparente]]
	((xyz123abc))
	((def456ghi))