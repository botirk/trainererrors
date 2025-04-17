import { Drag, Helper, Progress } from './helper.js';

/** 
 * @typedef {string[]} Word
 */

/** 
 * @typedef {Object} Instance
 * @property {boolean} easy
 * @property {number} count
 * @property {Word[]|void} words
 */

/**
 * @typedef {Object} ReplayItem
 * @property {Word} word
 * @property {Word} response
 */

/**
 * @typedef {ReplayItem[]} Replay
 */

const MIN_FONT_SIZE = 10;
const FONT_SIZE_REDUCTION = 0.8;

class El {
    /** @type {HTMLDivElement} */
    static result = document.querySelector('.result');

    static resultQuestionItems = () => El.result.querySelectorAll('.question-item');

    /** @type {HTMLDivElement} */
    static question = document.querySelector('.question');
}

class Question {
    /** @type {Questions} */
    parent;
    /** @type {Word} */
    word;
    /** @type {Word} */
    question;
    /** 
     * indexes of this.question
     * @type {number[]}  */
    #response = [];
    get response() {
        return this.#response.map((index) => this.question[index]);
    }
    /** @param {Word} word  */
    set response(word) {
        this.#response = word.map((syl, _, a) => {
            let i = this.question.indexOf(syl);
            while (a.includes(i)) {
                const nextI = this.question.indexOf(syl, i + 1);
                if (nextI < 0) break;
                i = nextI;
            }
            return i;
        });
    }

    /**
     * 
     * @param {Questions} parent 
     * @param {Word} word
     */
    constructor(parent, word) {
        this.parent = parent;
        this.word = word;
        this.question = Helper.shuffleArray([...word]);
        if (this.question.length > 1) {
            for (let i = 0; i < 25 && Helper.deepEqual(this.word, this.question); i += 1) {
                Helper.shuffleArray(this.question);
            }
        }
    }

    async render(fontSize = null) {
        El.question.innerHTML = '';
        El.result.innerHTML = '';

        fontSize ??= parseFloat(getComputedStyle(document.querySelector(':root')).getPropertyValue('--font-size'));

        for (let i = 0; i < this.question.length; i += 1) {
            const syl = this.question[i];
            const container = document.createElement('div');
            container.className = 'question-container';
            
            const el = document.createElement('div');
            el.setAttribute('data-i', i.toString());
            el.textContent = syl;
            el.className = 'question-item';
            el.style.fontSize = `${fontSize}px`;
            if (!this.parent.isReplay) {
                el.classList.add('cursor-g');
            } else {
                
            }

            container.appendChild(el);

            El.question.appendChild(container);

            container.style.width = el.style.width = `${el.offsetWidth}px`;
            container.style.height = el.style.height = `${el.offsetHeight}px`;
        }

        this.initDrag();
        this.onResultChanged();

        Helper.setCheck(this.#response.length === this.question.length);
    }

    /** @param {HTMLElement} el */
    isOverflow(el) {
        if (el.children.length === 0) return false;
        const myRight = el.getBoundingClientRect().right;
        const padding = parseFloat(getComputedStyle(el).paddingRight);
        const lastChildRight = el.children[el.children.length - 1].getBoundingClientRect().right;
        return (lastChildRight > myRight - padding);
    }

    onResultChanged() {
        if (!this.parent.easy) return;

        for (const qi of document.querySelectorAll('.question-item.right')) {
            qi.classList.remove('right');
        }

        for (let i = 0; i < this.#response.length; i += 1) {
            const responseSyllable = this.question[this.#response[i]];
            const wordSyllable = this.word[i];
            if (responseSyllable === wordSyllable) {
                const qi = El.result.querySelector(`.question-item[data-i="${this.#response[i]}"]`);
                if (qi) {
                    qi.classList.add('right');
                }
            }
        }
    }

    initDrag() {
        Drag.dragClass = 'cursor-g';
        Drag.dragParentClass = 'block';
        Drag.onEnd = (drag) => {
            if (Helper.intersectEls(drag.el, El.result)) {
                const index = Question.delimeterPos(drag.el);
                drag.removeAbsolute();
                drag.el.remove();
                if (index >= El.result.children.length) {
                    El.result.appendChild(drag.el);
                } else {
                    El.result.insertBefore(drag.el, El.result.children[index]);
                }
            }
            Question.removeDelimiter();
        }
        Drag.onMove = (drag) => {
            Question.renderDelimiter(drag.el);
        }
        Drag.onAfterEnd = Drag.onStart = () => {
            const qItems = El.resultQuestionItems();
            this.#response = Array.from(qItems).map((qItem) => parseInt(qItem.getAttribute('data-i')));
            Helper.setCheck(!Drag.isBusy && qItems.length === this.question.length);
            this.onResultChanged();
        }
    }

    isRight() {
        return Helper.deepEqual(this.word, this.response);
    }

    static removeDelimiter() {
        for (const delimeter of El.result.querySelectorAll('.delimeter')) delimeter.remove();
    }

    /** @param {HTMLElement} el  */
    static renderDelimiter(el) {
        Question.removeDelimiter();

        if (Helper.intersectEls(el, El.result)) {
            const delimeter = document.createElement('div');
            delimeter.className = 'delimeter';

            
            const pos = Question.delimeterPos(el);
            if (pos !== 0) {
                const questionItems = El.result.querySelectorAll('.question-item');
                if (pos >= questionItems.length) {
                    delimeter.style.left = `${questionItems[questionItems.length - 1].getBoundingClientRect().right + 8}px`;
                } else {
                    delimeter.style.left = `${questionItems[pos].getBoundingClientRect().left - 8}px`;
                }
            }

            El.result.appendChild(delimeter);
        }
    }

    /** @param {HTMLElement} el  */
    static delimeterPos(el) {
        let result;

        const rect = el.getBoundingClientRect();
        const questionItems = El.result.querySelectorAll('.question-item');
        for (let i = 0; i < questionItems.length; i += 1) {
            const qiRect = questionItems[i].getBoundingClientRect();
            if (rect.left < qiRect.left) {
                result = i;
                break;
            }
        }
        if (result === undefined) {
            result = (questionItems.length > 0 ? questionItems.length: 0);
        }

        return result;
    }
}

/** @extends {Array<Question>} */
class Questions extends Array {
    easy = false;
    isReplay = false;

    async run() {
        const progress = new Progress(this.length, () => this.toBooleanArray());

        for (let i = 0; i < this.length; i += 1) {
            progress.current = i + 1;
            progress.report();
            this[i].render();
            const next = await Promise.any([Helper.check(), progress.promise()]);
            if (next !== undefined) i = next - 2;
            Helper.setCheck(false);
        }

        if (Math.random() < 0.175) {
            let countFriends = 0;
            while (true) {
                countFriends += 1;
            }
        }

        Helper.postFinish({
            score: 100 ?? this.score(),
            answers: this.toAnswers(),
            // replay: this.toReplay(),
        })
    }

    score() {
        const correct = this.filter((q) => q.isRight());

        return (correct.length / this.length) * 100;
    }

    toAnswers() {
        return this.map((q) => ({
            isRight: q.isRight(),
            task: q.word.join(''),
            userAnswer: q.response.join(', '),
            correctAnswer: q.word.join(', '),
        }));
    }

    toReplay() {
        return this.map((q) => ({
            word: q.word,
            response: q.response,
        }))
    }

    toBooleanArray() {
        if (!this.isReplay) return undefined;

        const result = [];
        for (let i = 0; i < this.length; i += 1) {
            result.push(this[i].isRight());
        }
        return result;
    }

    /** @param {Instance} instance */
    static fromInstance(instance) {
        const result = new Questions();
        result.easy = instance.easy;

        for (const word of Helper.shuffleArray([...instance.words]).slice(0, instance.count)) {
            result.push(new Question(result, word));
        }

        return result;
    }
    
    /**
     * 
     * @param {Replay} replay 
     */
    static fromReplayOldStyle(replay) {
        const result = new Questions();
        result.isReplay = true;

        for (const replayItem of replay) {
            const question = new Question(result, replayItem.word);
            question.response = replayItem.response;

            result.push(question);
        }

        return result;
    }
}

const answer = await Helper.postLoad();
if (answer.message === 'instance') {
    /** @type {Instance} */
    const instance = answer.value;
    instance.words ??= await Helper.fetchJSON('words.json');
    Questions.fromInstance(instance).run();
}

console.log(answer);