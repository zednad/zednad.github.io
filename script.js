document.addEventListener("DOMContentLoaded", () => {
    const uploadInput = document.getElementById("upload");
    const startQuizBtn = document.querySelector(".start_quiz");
    const quizBox = document.querySelector(".quiz_box");
    const resultBox = document.querySelector(".result_box");
    const questionText = document.querySelector(".question_text");
    const optionList = document.querySelector(".option_list");
    const nextBtn = document.querySelector(".next");
    const finishBtn = document.querySelector(".finish");
    const restartBtn = document.querySelector(".restart");
    const quitBtn = document.querySelector(".quit");
    const uploadBox = document.getElementById("upload_box");
    const loadingScreen = document.querySelector(".loader");
    const fileList = document.getElementById("file_list");
    const cancelBtn = document.querySelector(".cancel_btn");
    const checkAnswerBtn = document.querySelector(".check_answer");

    let uploadedFile = null;
    let currentQuestion = 0;
    let score = 0;
    let questions = [];


    // Disable both buttons initially
    startQuizBtn.setAttribute("disabled", true);
    cancelBtn.setAttribute("disabled", true);
    

    // Click to upload
    uploadBox.addEventListener("click", () => {
        uploadInput.click();
    });

    // File selected
    uploadInput.addEventListener("change", (e) => {
        uploadedFile = e.target.files[0];
        if (uploadedFile && uploadedFile.type === "application/pdf") {
            fileList.innerHTML = ''; // Clear previous files
            
            // Create a container for the tick and file name
            const fileItem = document.createElement("div");
            fileItem.classList.add("file-item");
    
            // Add green tick icon
            const tickIcon = document.createElement("span");
            tickIcon.classList.add("tick-icon");
            tickIcon.innerHTML = "&#10004;"; // Unicode for the check mark
    
            // Create a span for the file name
            const fileName = document.createElement("span");
            fileName.textContent = uploadedFile.name;
    
            // Append tick and file name to the container
            fileItem.appendChild(tickIcon);
            fileItem.appendChild(fileName);
    
            // Append the container to the file list
            fileList.appendChild(fileItem);
    
            startQuizBtn.removeAttribute("disabled");
            cancelBtn.removeAttribute("disabled");
            cancelBtn.classList.add("enabled");
        } else {
            alert("Please upload a PDF file.");
            uploadInput.value = ''; // Clear the input
        }
    });

    // Drag and drop
    uploadBox.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = "#5a77ff";
    });

    uploadBox.addEventListener("dragleave", (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = "#ccc";
    });

    uploadBox.addEventListener("drop", (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const maxSizeInMB = 10;
            const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    
            if (file.size > maxSizeInBytes) {
                alert(`Please upload a PDF file smaller than ${maxSizeInMB}MB.`);
                return;
            }
    
            if (file.type === "application/pdf") {
                uploadInput.files = e.dataTransfer.files; // Assign the file to the input
                fileList.innerHTML = ''; // Clear previous files
                const fileItem = document.createElement("p");
                fileItem.textContent = file.name;
                fileList.appendChild(fileItem);
                uploadBox.style.borderColor = "#ccc";
                startQuizBtn.removeAttribute("disabled");
                uploadedFile = file; // Update the global uploadedFile variable
            } else {
                alert("Please upload a PDF file.");
            }
        }
    });
    

    // Cancel button - removes the uploaded file
    cancelBtn.addEventListener("click", () => {
        uploadInput.value = '';
        fileList.innerHTML = '';
        startQuizBtn.setAttribute("disabled", true);
        cancelBtn.setAttribute("disabled", true);
        cancelBtn.classList.remove("enabled");  // Remove the class to reset the color

        uploadBox.style.borderColor = "#ccc"; // Reset border color
        uploadedFile = null; // Reset the global uploadedFile variable
    });

    startQuizBtn.addEventListener("click", async () => {
        if (uploadedFile) {
            // Show the loading screen
            loadingScreen.classList.remove("hide");
            document.querySelector(".upload_dialog").classList.add("hide");

            try {
                const extractedText = await extractTextFromPDF(uploadedFile);
                questions = await generateQuestionsFromText(extractedText);
                displayQuestions();

                // Hide the loading screen and show the quiz
                loadingScreen.classList.add("hide");
                quizBox.classList.remove("hide");
            } catch (error) {
                console.error("Error generating questions:", error);
                alert("There was an error generating the quiz. Please try again later.");

                // Hide the loading screen in case of an error
                loadingScreen.classList.add("hide");
                document.querySelector(".upload_dialog").classList.remove("hide");
            }
        }
    });

    async function extractTextFromPDF(file) {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async function() {
                try {
                    const typedArray = new Uint8Array(reader.result);
                    const loadingTask = pdfjsLib.getDocument(typedArray);
                    const pdf = await loadingTask.promise;
                    let text = '';
                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const textContent = await page.getTextContent();
                        text += textContent.items.map(item => item.str).join(' ') + ' ';
                    }
                    resolve(text);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    async function generateQuestionsFromText(text) {
        try {
            const response = await fetch('https://quiz-backend-2-2c8c564479f9.herokuapp.com/generate-questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });
    
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
    
            const data = await response.json();
            const questions = data.choices[0].message.content;
            console.log(questions);
            return parseQuestions(questions);
        } catch (error) {
            console.error("Error contacting the backend API:", error);
            throw error;
        }
    }
    

    function parseQuestions(apiResponse) {
        const questionBlocks = apiResponse.split('\n\n');  // Assuming questions are separated by two newlines
        return questionBlocks.map((block) => {
            const lines = block.split('\n').filter(line => line.trim() !== '');
            const question = lines[0].replace(/^\d+\.\s/, '');  // Remove leading numbers like "1. "
    
            // Extract the correct answer from the last line
            const correctAnswerLine = lines[lines.length - 1];
            const correctAnswerMatch = correctAnswerLine.match(/Correct Answer:\s([A-D])/i);
    
            if (!correctAnswerMatch) {
                console.error('Error: Could not find the correct answer in:', correctAnswerLine);
                return null;  // Skip this question block if the correct answer can't be found
            }
    
            const correctAnswerLetter = correctAnswerMatch[1];  // Extract the letter after "**Correct Answer: "
    
            // Extract options
            const options = lines.slice(1, -1).map(option => option.replace(/^[a-dA-D]\)\s/, '').trim());  // Remove "A) ", "B) ", etc.
    
            // Match the correct answer letter to the corresponding index
            const correctAnswerIndex = correctAnswerLetter.charCodeAt(0) - 65;  // Convert 'A' to 0, 'B' to 1, etc.
    
            if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
                console.error('Error: Invalid correct answer index:', correctAnswerIndex, 'in options:', options);
                return null;  // Skip this question block if the index is out of bounds
            }
    
            return {
                question: question,
                options: options,
                correctAnswer: correctAnswerIndex
            };
        }).filter(Boolean);  // Filter out any null results due to errors
    }

    function updateProgressBar() {
        const progressBar = document.getElementById('progress_bar');
        const progressPercentage = ((currentQuestion) / questions.length) * 100;
        progressBar.style.width = progressPercentage + '%';
    }
    
    function displayQuestions() {
        showQuestion(currentQuestion);
    
        nextBtn.addEventListener("click", () => {
            calculateScore();
            currentQuestion++;
            if (currentQuestion < questions.length) {
                showQuestion(currentQuestion);
            }
            updateProgressBar(); //Update Progress Bar on every question
        });
    
        finishBtn.addEventListener("click", () => {
            calculateScore();
            showResult();
        });
    
        restartBtn.addEventListener("click", () => {
            currentQuestion = 0;
            score = 0;
            resultBox.classList.add("hide");
            quizBox.classList.remove("hide");
            showQuestion(currentQuestion);
            updateProgressBar(); //Update the Progress Bar if the quiz is restarted
        });
    
        quitBtn.addEventListener("click", () => {
            location.reload();
        });
    
        document.querySelector(".check_answer").addEventListener("click", () => {
            checkAnswer();
            // Disable further option selection after checking the answer
            const options = document.querySelectorAll(".option");
            options.forEach(option => {
                option.classList.add("disabled");
                option.style.pointerEvents = 'none'; // Disable click
            });
            // Disable the "Check Answer" button
            document.querySelector('.check_answer').disabled = true;
        });
    }
    
    function showQuestion(index) {
        const questionElement = questionText;
        const optionElement = optionList;
    
        // Add zoom-out effect to current question and options
        questionElement.classList.add('zoom-out');
        optionElement.classList.add('zoom-out');
    
        // Wait for the zoom-out animation to complete before updating the content
        setTimeout(() => {
            // Update question and options content
            questionElement.textContent = questions[index].question;
            optionElement.innerHTML = '';
            questions[index].options.forEach((option, i) => {
                const optionBtn = document.createElement("div");
                optionBtn.classList.add("option");
                optionBtn.textContent = option;
                optionBtn.addEventListener("click", () => selectOption(i));
                optionElement.appendChild(optionBtn);
            });
    
            // Remove zoom-out effect and add zoom-in effect
            questionElement.classList.remove('zoom-out');
            optionElement.classList.remove('zoom-out');
            questionElement.classList.add('zoom-in');
            optionElement.classList.add('zoom-in');
    
            // Remove the zoom-in class after the animation is done to reset for the next question
            setTimeout(() => {
                questionElement.classList.remove('zoom-in');
                optionElement.classList.remove('zoom-in');
            }, 400); // Match this duration with the animation-duration in CSS
    
        }, 400); // Match this duration with the animation-duration in CSS
    
        updateButtons();
        updateProgressBar();
    
        // Initially disabling the check answer button for each question until user selects an option
        document.querySelector('.check_answer').disabled = true;
    }
    
    function selectOption(index) {
        const options = document.querySelectorAll(".option");
        options.forEach(option => option.classList.remove("selected"));
        options[index].classList.add("selected");
    
        // Enabling the check answer button when the user selects an option
        document.querySelector('.check_answer').disabled = false;
    }
    
    function updateButtons() {
        nextBtn.classList.toggle("hide", currentQuestion === questions.length - 1);
        finishBtn.classList.toggle("hide", currentQuestion !== questions.length - 1);
    }
    
    function checkAnswer() {
        const selectedOption = document.querySelector(".option.selected");
        const correctAnswerIndex = questions[currentQuestion].correctAnswer;
    
        if (selectedOption) {
            const selectedIndex = Array.from(selectedOption.parentNode.children).indexOf(selectedOption);
            const options = document.querySelectorAll(".option");
            options.forEach((option, index) => {
                if (index === correctAnswerIndex) {
                    option.classList.add("correct"); // Add correct style
                } else {
                    option.classList.add("incorrect"); // Add incorrect style
                }
            });
        }
    }
    
    function calculateScore() {
        const selectedOption = document.querySelector(".option.selected");
        if (selectedOption) {
            const selectedIndex = Array.from(selectedOption.parentNode.children).indexOf(selectedOption);
            if (selectedIndex === questions[currentQuestion].correctAnswer) {
                score++;
            }
        }
    }
    
    function showResult() {
        quizBox.classList.add("hide");
        resultBox.classList.remove("hide");
        resultBox.querySelector(".result_text").textContent = `You scored ${score} out of ${questions.length}`;
    }
    
});
