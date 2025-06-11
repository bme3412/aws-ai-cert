import os
import re
from flask import Flask, render_template

app = Flask(__name__)

def parse_quiz_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")
        return []

    questions_text, answers_text = "", ""
    try:
        # Split content into questions and answers
        parts = re.split(r'\n---\s*---+\s*\n\s*# Answer Key', content, maxsplit=1)
        if len(parts) == 2:
            questions_text, answers_text = parts
        else:
            print(f"Warning: Primary split failed for {file_path}. Trying fallback.")
            # Fallback split
            parts = re.split(r'# Answer Key', content, maxsplit=1)
            if len(parts) == 2:
                questions_text, answers_text = parts
                # Clean up the separator from questions_text
                questions_text = re.sub(r'---\s*---+\s*$', '', questions_text).strip()
            else:
                print(f"Error: Could not find answer key section in {file_path}")
                return []
    except Exception as e:
        print(f"Error splitting content for {file_path}: {e}")
        return []

    questions = []
    
    # Process questions
    questions_text = questions_text.strip()
    if not questions_text:
        print(f"Error: No questions text found after split in {file_path}")
        return []

    # Simplified split into chunks based on the question marker
    question_chunks = re.split(r'\s*(?=\*\*\d+\.)', questions_text)

    # The first element might be section headers or empty space, so find where questions start
    first_question_index = -1
    for i, chunk in enumerate(question_chunks):
        if chunk.strip().startswith('**'):
            first_question_index = i
            break
            
    if first_question_index == -1:
        print(f"Error: No question chunks found in {file_path}")
        return []

    current_section = "General"
    for chunk in question_chunks[first_question_index:]:
        chunk = chunk.strip()
        if not chunk:
            continue
        
        # This is a very simple way to find section headers, assuming they are on their own lines
        if chunk.startswith('###'):
            current_section = chunk.replace('###', '').strip()
            continue
            
        q_match = re.match(r'\*\*(?P<num>\d+)\.\s*(?P<text>.*?)(?=\s*[a-d]\))', chunk, re.DOTALL)
        if not q_match:
            print(f"Warning: No question match in chunk:\n---\n{chunk}\n---")
            continue
            
        question_number = int(q_match.group('num'))
        question_text = q_match.group('text').strip()

        options = []
        option_matches = re.findall(r'^\s*([a-d])\)\s*(.*)', chunk, re.MULTILINE)
        for opt_key, opt_val in option_matches:
            options.append({"key": opt_key, "text": opt_val.strip()})

        if options:
            questions.append({
                "question_number": question_number,
                "text": question_text,
                "options": options,
                "section": current_section
            })
        else:
            print(f"Warning: No options found for question {question_number}")

    if not questions:
        print(f"Error: Failed to parse any questions from {file_path}")
        return []
    
    # --- Answer Parsing ---
    answers = {}
    for line in answers_text.strip().split('\n'):
        line = line.strip()
        if not line: continue
        match = re.match(r'^\s*(\d+)\s*\.\s*\*?([a-d])\b', line)
        if match:
            answers[int(match.group(1))] = match.group(2)

    for q in questions:
        if q['question_number'] in answers:
            q['answer'] = answers[q['question_number']]
        else:
            print(f"Warning: No answer found for question {q['question_number']} in {file_path}")

    return questions

def get_quiz_modules():
    modules = []
    base_path = os.path.join(os.path.dirname(__file__), '..', 'aws-cloud-practicioner-fundamentals')
    
    if not os.path.exists(base_path):
        return []

    def sort_key(dir_name):
        match = re.search(r'module-(\d+)', dir_name)
        if match:
            return int(match.group(1))
        return float('inf')  # Put non-matching directories at the end

    all_module_dirs = os.listdir(base_path)
    sorted_module_dirs = sorted(all_module_dirs, key=sort_key)
        
    for module_dir in sorted_module_dirs:
        module_path = os.path.join(base_path, module_dir)
        practice_file = os.path.join(module_path, 'practice-questions.txt')
        
        if os.path.isdir(module_path) and os.path.exists(practice_file):
            display_name = module_dir.replace('-', ' ').replace('_', ' ').title()
            
            try:
                # Try to extract a more descriptive name from the file's title
                with open(practice_file, 'r', encoding='utf-8') as f:
                    first_line = f.readline().strip()
                    if first_line.startswith('#'):
                        match = re.search(r'#\s*AWS\s*(Module\s*\d+:\s*.*?)\s*Practice Questions', first_line, re.IGNORECASE)
                        if match:
                            display_name = match.group(1).strip()
            except Exception:
                # If it fails, just use the directory name
                pass

            modules.append({
                'dir_name': module_dir,
                'display_name': display_name,
                'file_name': 'practice-questions.txt'
            })
    return modules

@app.route("/")
def index():
    modules = get_quiz_modules()
    return render_template("index.html", modules=modules)

@app.route("/quiz/<module>/<filename>")
def quiz(module, filename):
    # Basic security check
    if '..' in module or '..' in filename:
        return "Invalid path", 400

    base_path = os.path.join(os.path.dirname(__file__), '..', 'aws-cloud-practicioner-fundamentals')
    file_path = os.path.join(base_path, module, filename)

    try:
        questions = parse_quiz_file(file_path)
        if not questions:
            error_message = f"Could not parse quiz file or file is empty: {module}/{filename}"
            print(error_message)
            return error_message, 500
        
        # Determine title from module directory name
        title = module.replace('-', ' ').replace('_', ' ').title()
        return render_template("quiz.html", questions=questions, title=title)
    except FileNotFoundError:
        return "Quiz file not found!", 404
    except Exception as e:
        print(f"Error processing file {file_path}: {e}")
        return "An unexpected error occurred while processing the quiz file.", 500

if __name__ == "__main__":
    app.run(debug=True, port=5001) 