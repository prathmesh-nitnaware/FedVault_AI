import docx
from docx.shared import Pt, Cm
doc = docx.Document(r'd:\yash\Scalable Project\FedVault_AI\Mini Project Report Format.docx')

# Check styles deeply
style_doc = doc.styles
for s in ['Heading 1', 'Heading 3', 'Normal', 'Body Text', 'List Paragraph']:
    try:
        st = style_doc[s]
        pf = st.paragraph_format
        rf = st.font
        try:
            color = str(rf.color.rgb)
        except:
            color = "inherited"
        print(f'Style: {s}')
        print(f'  Font: name={rf.name} size={rf.size} bold={rf.bold} color={color}')
        print(f'  Para: align={pf.alignment} space_before={pf.space_before} space_after={pf.space_after} line_spacing={pf.line_spacing}')
    except Exception as e:
        print(f'Error for {s}: {e}')

print()
print('=== CONTENT SECTIONS ===')
for i, p in enumerate(doc.paragraphs[73:210]):
    if p.text.strip():
        print(f'P{73+i} [{p.style.name}]: {p.text[:150]!r}')
