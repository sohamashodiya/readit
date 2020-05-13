// Make notes editable, configure NSIS installer.
const app = require('electron');
const ipcRenderer = require('electron').ipcRenderer;

const clipboard = require('electron').clipboard;
const open = require("open");

const Store = require('electron-store');
const isbn = require('node-isbn');
const isbnValidator = require('isbn-validate');
const moment = require('moment');
const uuidv1 = require('uuid/v1');

const store = new Store();

var timelineSource;
var timelineTemplate;

var infoFinishedReadingSource;
var infoFinishedReadingTemplate;

var infoCurrentlyReadingSource;
var infoCurrentlyReadingTemplate;

var finishedReadingListSource;
var finishedReadingListTemplate;

var currentlyReadingListSource;
var currentlyReadingListTemplate;

var toReadListSource;
var toReadListTemplate;

var tagSelectSource;
var tagSelectTemplate;

var editTagSelectSource;
var editTagSelectTemplate;

var tagManagerListSource;
var tagManagerListTemplate;

// Checks if users is launching app for first time, opens Help modal, and creates the structure of the store
app.ipcRenderer.on('firstAppLaunch', (event, message) => {
    console.log('Received First Launch Message');

    $('#helpModal').modal('open');

    store.clear();

    var today = moment(new Date());
    store.set('startDate', today);

    store.set('timeline', [{
        'event': 'Started using Readit',
        'date': today,
        'icon': {
            'name': 'flag',
            'color': 'rainbow'
        }
    }]);

    store.set('tags', []);
    store.set('toRead', []);
    store.set('currentlyReading', []);
    store.set('finishedReading', []);
});

// Initializes Handlebars Templates
function initializeHandlebarsTemplates() {
    timelineSource = document.getElementById("timelineTemplate").innerHTML;
    timelineTemplate = Handlebars.compile(timelineSource);

    infoFinishedReadingSource = document.getElementById("infoFinishedReadingTemplate").innerHTML;
    infoFinishedReadingTemplate = Handlebars.compile(infoFinishedReadingSource);

    infoCurrentlyReadingSource = document.getElementById("infoCurrentlyReadingTemplate").innerHTML;
    infoCurrentlyReadingTemplate = Handlebars.compile(infoCurrentlyReadingSource);

    finishedReadingListSource = document.getElementById("finishedReadingListTemplate").innerHTML;
    finishedReadingListTemplate = Handlebars.compile(finishedReadingListSource);

    currentlyReadingListSource = document.getElementById("currentlyReadingListTemplate").innerHTML;
    currentlyReadingListTemplate = Handlebars.compile(currentlyReadingListSource);

    toReadListSource = document.getElementById("toReadListTemplate").innerHTML;
    toReadListTemplate = Handlebars.compile(toReadListSource);

    tagSelectSource = document.getElementById("tagSelectTemplate").innerHTML;
    tagSelectTemplate = Handlebars.compile(tagSelectSource);

    editTagSelectSource = document.getElementById("editTagSelectTemplate").innerHTML;
    editTagSelectTemplate = Handlebars.compile(editTagSelectSource);

    tagManagerListSource = document.getElementById("tagManagerListTemplate").innerHTML;
    tagManagerListTemplate = Handlebars.compile(tagManagerListSource);
}

// Calculates days since first app launch, and updates the widget
function daysSinceStartWidget() {
    var today = moment(new Date());

    $('#daysSinceStart').text(today.diff(store.get('startDate'), 'days'));
}

// Calculates the total number of finished books
function finishedBooksWidget() {
    var finishedBooksArray = store.get('finishedReading');

    if (finishedBooksArray) {
        $('#finishedBooksTotal').text(finishedBooksArray.length);
    } else {
        $('#finishedBooksTotal').text('0');
    }
}

// Calculate the total number of finished books based on week, month, and year
function filterTotalFinishedBooksWidget(filter) {
    if (!filter) {
        $('#filterTotalFinishedBooksDropdown li a').click(function () {
            filterTotalFinishedBooksWidget($(this).data('filter'));
        });

        filter = 'week';
    }

    var finishedBooksArray = store.get('finishedReading');

    var totalBooksReadInWeek = 0;

    if (finishedBooksArray) {
        for (var i = 0; i < finishedBooksArray.length; i++) {
            if (moment(finishedBooksArray[i].dateFinished).isSame(new Date(), filter)) {
                totalBooksReadInWeek += 1;
            }
        }
    }

    $('#thisText').text(filter);
    $('#thisValue').text(totalBooksReadInWeek);
}

// Shows and hides previous and next arrows based on current slide
function changeCarouselNavigation() {
    var helpCarousel = $('#helpCarousel');
    var helpCarouselInstance = M.Carousel.getInstance(helpCarousel);

    var carouselLength = $('#helpCarousel .indicators li').length;

    if (!helpCarouselInstance) {
        $('.previousCarousel .btn-floating').removeClass('scale-out');
        $('.nextCarousel .btn-floating').removeClass('scale-out');
    } else {
        if (helpCarouselInstance.center == 0) {
            $('.previousCarousel .btn-floating').addClass('scale-out');
        } else if (helpCarouselInstance.center == carouselLength - 1) {
            $('.nextCarousel .btn-floating').addClass('scale-out');
        } else {
            $('.previousCarousel .btn-floating').removeClass('scale-out');
            $('.nextCarousel .btn-floating').removeClass('scale-out');
        }
    }
}

// Initializes the Help Carousel
function initializeHelpCarousel() {
    var helpCarousel = $('#helpCarousel');

    var helpCarouselInstance = M.Carousel.init(helpCarousel, {
        fullWidth: true,
        indicators: true,
        noWrap: true,
        onCycleTo: changeCarouselNavigation
    });

    $('.nextCarousel').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        helpCarousel.carousel('next');
    });

    $('.previousCarousel').click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        helpCarousel.carousel('prev');
    });
}

// Destroys Help Carousel
function destroyHelpCarousel() {
    $('#helpCarousel').carousel('set', 0);
    $('#helpCarousel').carousel('destroy');
    $('#helpCarousel .indicators').remove();
}

// Initializes all Materialize widgets
function initializeMaterializeWidgets() {
    $('.tabs').tabs();
    $('select').formSelect();
    $('.tooltipped').tooltip();
    $('.filterTotalFinishedBooksDropdownTrigger').dropdown();

    filterTotalFinishedBooksWidget();

    initializeChips();

    var helpModal = $('#helpModal');
    var helpModalInstance = M.Modal.init(helpModal, {
        'dismissible': false,
        'onOpenEnd': initializeHelpCarousel,
        'onCloseStart': destroyHelpCarousel
    });

    var resetModal = $('#resetModal');
    var resetModalInstance = M.Modal.init(resetModal, {
        'dismissible': false,
        'onCloseEnd': clearResetForm,
    });

    var newBookModal = $('#newBookModal');
    var newBookModalInstance = M.Modal.init(newBookModal, {
        'onOpenStart': populateTagSelect,
        'onCloseEnd': clearNewBookForm,
        'dismissible': false
    });

    var newTagModal = $('#newTagModal');
    var newTagModalInstance = M.Modal.init(newTagModal, {
        'onOpenStart': populateBookSelect,
        'onOpenEnd': newTagModalFix,
        'onCloseEnd': clearNewTagForm,
        'dismissible': false
    });

    var editBookModal = $('#editBookModal');
    var editBookModalInstance = M.Modal.init(editBookModal, {
        'onOpenStart': initializeChips,
        'onCloseEnd': clearEditBookForm,
        'dismissible': false
    });

    var infoCurrentlyReadingBookModal = $('#infoCurrentlyReadingBookModal');
    var infoCurrentlyReadingBookModalInstance = M.Modal.init(infoCurrentlyReadingBookModal, {
        'dismissible': false
    });

    var infoFinishedReadingBookModal = $('#infoFinishedReadingBookModal');
    var infoFinishedReadingBookModalInstance = M.Modal.init(infoFinishedReadingBookModal, {
        'dismissible': false
    });
}

// Populates tag selection on newBookModal
function populateTagSelect() {
    var tagArray = store.get('tags');

    var tagSelectHtml = tagSelectTemplate(tagArray);

    $('#disabledTag').after(tagSelectHtml);

    initializeChips();

    $('select').formSelect();
}

// Initializes chips for editBookModal and newBookModal
function initializeChips() {
    $('.editTagChips, .tagChips').chips({
        placeholder: 'Add new tags',
        secondaryPlaceholder: '+Tag',
    });
}

// Refreshes tab content on click
function tabHandlers() {
    $('.timelineTab').click(function () {
        populateTimeline();

        var elems = document.querySelector('#startDate');
        var instances = M.Datepicker.init(elems, {});

        var elems = document.querySelector('#endDate');
        var instances = M.Datepicker.init(elems, {});
    });

    $('.tagManagerTab').click(function () {
        populateTagManagerList();
    });
}

// Adds and removes Animate.css classes to elements
function animateCSS(element, animationName, callback) {
    const node = document.querySelector(element)
    node.classList.add('animated', animationName)

    function handleAnimationEnd() {
        node.classList.remove('animated', animationName)
        node.removeEventListener('animationend', handleAnimationEnd)

        if (typeof callback === 'function') callback()
    }

    node.addEventListener('animationend', handleAnimationEnd)
}

// Checks if device is connected to Internet
function isOnline() {
    return navigator.onLine;
}

// Isbn Handler for editBookModal and newBookModal
function isbnHandler(source) {
    if (!source) {
        $('.editIsbnBtn').click(function () {
            isbnHandler('edit');
        });

        $('.isbnBtn').click(function () {
            isbnHandler('new');
        });
    } else {
        var isbnElement;
        var tagChipsInstance;
        var titleElement;
        var authorElement;
        var tagChipsElement;

        if (source == 'edit') {
            isbnElement = '#editIsbn';
            titleElement = '#editTitle';
            authorElement = '#editAuthor';
            tagChipsElement = '.editTagChips';
        } else if (source == 'new') {
            isbnElement = '#isbn';
            titleElement = '#title';
            authorElement = '#author';
            tagChipsElement = '.tagChips';
        }

        if (isOnline()) {
            isbnNumber = removeSpaces($(isbnElement).val());

            if (isbnNumber && isbnValidator.Validate(isbnNumber)) {
                isbn.resolve(isbnNumber, function (err, book) {
                    if (err) {
                        M.toast({
                            html: 'Book not found',
                            classes: 'red'
                        });
                    } else {
                        var title = book.title;
                        var author = book.authors.join(", ");
                        var tags = book.categories;

                        $(titleElement).val(title);
                        $(authorElement).val(author);

                        tagChipsInstance = M.Chips.getInstance($(tagChipsElement));

                        for (var i = 0; i < tags.length; i++) {
                            tagChipsInstance.addChip({
                                tag: tags[i]
                            });
                        }

                        animateCSS(titleElement, 'fadeIn');
                        animateCSS(authorElement, 'fadeIn');
                        animateCSS(tagChipsElement, 'fadeIn');

                        M.toast({
                            html: 'Updated Fields',
                            classes: 'green'
                        });
                    }
                });
            } else {
                M.toast({
                    html: 'Invalid ISBN',
                    classes: 'orange'
                });
            }
        } else {
            M.toast({
                html: 'No Internet Connection',
                classes: 'red'
            });
        }
    }
}

// Applies title case to string
function titleCase(str) {
    var splitStr = str.toLowerCase().split(' ');

    for (var i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }

    return splitStr.join(' ');
}

// Removes spaces from string
function removeSpaces(str) {
    return str.replace(/ /g, '');
}

// Checks if a duplicate book title exists
function checkBookTitleExists(title, bookUuid) {
    var toReadArray = store.get('toRead');

    var currentlyReadingArray = store.get('currentlyReading');

    var finishedReadingArray = store.get('finishedReading');

    var allBooksArray = toReadArray.concat(currentlyReadingArray, finishedReadingArray);

    for (var i = 0; i < allBooksArray.length; i++) {
        if (bookUuid == null) {
            if (allBooksArray[i].title.toLowerCase() == title.toLowerCase()) {
                return true;
            }
        } else {
            if (allBooksArray[i].title.toLowerCase() == title.toLowerCase() && allBooksArray[i].uuid !== bookUuid) {
                return true;
            }
        }
    }

    return false;
}

// Checks whether current item is unique
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

// Handler for new book form
function newBookFormHandler() {
    $('.newBookBtn').click(function () {
        var title = removeSpaces($('#title').val());
        var author = removeSpaces($('#author').val());

        if (checkBookTitleExists(title, null)) {
            animateCSS('#title', 'bounce');

            M.toast({
                html: 'Title already in use',
                classes: 'orange'
            });
        } else if (!title || !author) {
            animateCSS('#title', 'bounce');
            animateCSS('#author', 'bounce');

            M.toast({
                html: 'Required fields are missing',
                classes: 'orange'
            });
        } else if (removeSpaces($('.tagChips input').val())) {
            animateCSS('.tagChips', 'bounce');

            M.toast({
                html: "Please check that your new tags are registered",
                classes: 'orange'
            });
        } else {
            var today = moment(new Date());

            var tags = $('#tags').formSelect('getSelectedValues');

            var tagChipsArray = M.Chips.getInstance($('.tagChips')).chipsData.map(function (obj) {
                return obj.tag;
            });

            tags = tags.concat(tagChipsArray);

            tags = tags.map(function (tag) {
                return titleCase(tag);
            });

            tags = tags.filter(onlyUnique);

            var tagArray = store.get('tags');

            for (var i = 0; i < tags.length; i++) {
                if (!tagArray.includes(titleCase(tags[i]))) {
                    tagArray.push(titleCase(tags[i]));
                    tagArray.sort();
                }
            }

            store.set('tags', tagArray);

            var uuid = uuidv1();

            var book = {
                'uuid': uuid,
                'title': $('#title').val(),
                'author': $('#author').val(),
                'tags': tags.sort(),
                'notes': $('#notes').val(),
                'dateAdded': today
            }

            var toReadArray = store.get('toRead');

            toReadArray.push(book);

            store.set('toRead', toReadArray);

            var timelineEntry = {
                'event': 'Added: ' + $('#title').val(),
                'date': today,
                'icon': {
                    'name': 'add',
                    'color': 'green'
                },
                'uuid': uuid
            }

            var timelineArray = store.get('timeline');

            timelineArray.unshift(timelineEntry);

            store.set('timeline', timelineArray);

            $('#newBookModal').modal('close');

            M.toast({
                html: 'Book Added',
                classes: 'green'
            });

            populateToReadList();
        }
    });
}

function undoNotes(source) {
    if (!source) {
        $('.undoCurrentlyReadingNotesBtn, .undoFinishedReadingNotesBtn').unbind('click');

        $('.undoCurrentlyReadingNotesBtn').click(function () {
            undoNotes('currentlyReading');
        });

        $('.undoFinishedReadingNotesBtn').click(function () {
            undoNotes('finishedReading');
        });
    } else if (source == "currentlyReading" || source == "finishedReading") {
        var notesElement;
        var initialNotes;

        if (source == "currentlyReading") {
            notesElement = '#infoCurrentlyReadingNotes';
            initialNotes = $('#infoCurrentlyReadingInitialNotes').text();
        } else if (source == "finishedReading") {
            notesElement = '#infoFinishedReadingNotes';
            initialNotes = $('#infoFinishedReadingInitialNotes').text();
        }

        $(notesElement).val(initialNotes);

        animateCSS(notesElement, 'fadeIn');
    }
}

function editNotesChanged(source) {
    if (!source) {
        $('#infoCurrentlyReadingNotes, #infoFinishedReadingNotes').off('input');

        $('#infoCurrentlyReadingNotes').on('input', function() {
            console.log('Change');
            editNotesChanged('currentlyReading');
        });

        $('#infoFinishedReadingNotes').on('input', function() {
            editNotesChanged('finishedReading');
        });
    } else if (source == "currentlyReading" || source == "finishedReading") {
        var editBtn;
        var initialNotes;
        var notes;

        if (source == "currentlyReading") {
            editBtn = $('.editCurrentlyReadingNotesBtn');
            initialNotes = $('#infoCurrentlyReadingInitialNotes').text();
            notes = $('#infoCurrentlyReadingNotes').val();
        } else if (source == "finishedReading") {
            editBtn = $('.editFinishedReadingNotesBtn');
            initialNotes = $('#infoFinishedReadingInitialNotes').text();
            notes = $('#infoFinishedReadingNotes').val();
        }

        if (removeSpaces(notes) != "" && notes != initialNotes) {
            editBtn.removeClass('disabled');
        } else {
            editBtn.addClass('disabled');
        }
    }
}

function editNotesHandler(source) {
    if (!source) {
        $('.editCurrentlyReadingNotesBtn').click(function () {
            editNotesHandler('currentlyReading');
        });

        $('.editFinishedReadingNotesBtn').click(function () {
            editNotesHandler('finishedReading');
        });
    } else if (source == "currentlyReading" || source == "finishedReading") {
        var editModal;
        var notes;
        var uuid;

        if (source == "currentlyReading") {
            editModal = $('#infoCurrentlyReadingBookModal');
            notes = $('#infoCurrentlyReadingNotes').val();
            uuid = $('#infoCurrentlyReadingUuid').text();
        } else if (source == "finishedReading") {
            editModal = $('#infoFinishedReadingBookModal');
            notes = $('#infoFinishedReadingNotes').val();
            uuid = $('#infoFinishedReadingUuid').text();
        }

        var dataArray = store.get(source);

        for (var i = 0; i < dataArray.length; i++) {
            if (dataArray[i].uuid == uuid) {
                dataArray[i].notes = notes;
            }
        }

        store.set(source, dataArray);

        editModal.modal('close');

        M.toast({
            html: 'Notes Edited',
            classes: 'green'
        });
    }
}

// Handler for edit book form
function editBookFormHandler() {
    $('.editBookSubmitBtn').click(function () {
        if (checkBookTitleExists($('#editTitle').val(), $('#editBookUuid').val())) {
            animateCSS('#editTitle', 'bounce');

            M.toast({
                html: 'Title already in use',
                classes: 'orange'
            });
        } else if (!title || !author) {
            animateCSS('#editTitle', 'bounce');
            animateCSS('#editAuthor', 'bounce');

            M.toast({
                html: 'Required fields are missing',
                classes: 'orange'
            });
        } else if (removeSpaces($('.editTagChips input').val())) {
            animateCSS('.editTagChips', 'bounce');

            M.toast({
                html: "Please check that your new tags are registered",
                classes: 'orange'
            });
        } else {
            var tags = $('#editTags').formSelect('getSelectedValues');

            var tagChipsArray = M.Chips.getInstance($('.editTagChips')).chipsData.map(function (obj) {
                return obj.tag;
            });

            tags = tags.concat(tagChipsArray);

            tags = tags.map(function (tag) {
                return titleCase(tag);
            });

            tags = tags.filter(onlyUnique);

            var tagArray = store.get('tags');

            for (var i = 0; i < tags.length; i++) {
                if (!tagArray.includes(titleCase(tags[i]))) {
                    tagArray.push(titleCase(tags[i]));
                    tagArray.sort();
                }
            }

            store.set('tags', tagArray);

            var toReadArray = store.get('toRead');

            for (var j = 0; j < toReadArray.length; j++) {
                if (toReadArray[j].uuid == $('#editBookUuid').val()) {
                    toReadArray[j].title = $('#editTitle').val();
                    toReadArray[j].author = $('#editAuthor').val();
                    toReadArray[j].tags = tags.sort();
                    toReadArray[j].notes = $('#editNotes').val();
                }
            }

            store.set('toRead', toReadArray);

            populateToReadList();

            var timelineArray = store.get('timeline');

            for (var k = 0; k < timelineArray.length; k++) {
                if (timelineArray[k].uuid == $('#editBookUuid').val()) {
                    var event = timelineArray[k].event;
                    timelineArray[k].event = event.split(/:(.+)/)[0] + ": " + $('#editTitle').val();
                }
            }

            store.set('timeline', timelineArray);

            $('#editBookModal').modal('close');

            M.toast({
                html: 'Book Edited',
                classes: 'green'
            });
        }
    });
}

// Clears new book form
function clearNewBookForm() {
    $('#title, #author, #notes, .tagChips input, #isbn').val('');

    $('#tags option:not(#disabledTag)').remove();
    $('select').formSelect();

    $('.tagChips .chip').remove();
}

// Clears edit book form
function clearEditBookForm() {
    $('#editTitle, #editAuthor, #editNotes, .editTagChips input, #editIsbn').val('');

    $('#editTags option:not(#disabledEditTag)').remove();
    $('select').formSelect();

    $('.editTagChips .chip').remove();
}

// Clears new tag form
function clearNewTagForm() {
    $('#newTag, .addBooksChips input').val('');

    $('.addBooksChips .chip').remove();
}

// Clears reset form
function clearResetForm() {
    $('#resetName').val('');

    $('.resetBtn').addClass('disabled');
}

// Populates timeline
function populateTimeline() {
    var timelineArray = store.get('timeline');

    timelineArray.map(function (event) {
        var formattedDate = moment(event.date).format('llll');
        event.date = formattedDate;

        return event;
    })

    var timelineHtml = timelineTemplate(timelineArray);

    $('.timeline').html(timelineHtml);
}

// Populates toReadList
function populateToReadList() {
    var toReadArray = store.get('toRead');

    var toReadListHtml = toReadListTemplate(toReadArray);

    $('.toReadListContainer').html(toReadListHtml);

    $('.tooltipped').tooltip();
}

// Populates currentlyReadingList
function populateCurrentlyReadingList() {
    var currentlyReadingArray = store.get('currentlyReading');

    var currentlyReadingListHtml = currentlyReadingListTemplate(currentlyReadingArray);

    $('.currentlyReadingListContainer').html(currentlyReadingListHtml);

    $('.tooltipped').tooltip();
}

// Populates finishedReadinglist
function populateFinishedReadingList() {
    var finishedReadingArray = store.get('finishedReading');

    var finishedReadingListHtml = finishedReadingListTemplate(finishedReadingArray);

    $('.finishedReadingListContainer').html(finishedReadingListHtml);

    $('.tooltipped').tooltip();
}

// Handler for search on toReadList
function toReadListSearchHandler() {
    $('.toReadListSearchBox').on('input', function () {
        var search = $('.toReadListSearchBox').val().toLowerCase().trim();

        if (removeSpaces(search) != '') {
            var toReadArray = store.get('toRead');

            toReadArray = toReadArray.filter(function (book) {
                if (book.title.toLowerCase().includes(search) || book.author.toLowerCase().includes(search)) {
                    return book;
                } else {
                    for (var i = 0; i < book.tags.length; i++) {
                        if (book.tags[i].toLowerCase().includes(search)) {
                            return book;
                        }
                    }
                }
            });

            if (toReadArray.length == 0) {
                var toReadListHtml = '<div class="emptyListContainer center"><img class="emptyListImage emptyNotFoundImage animated pulse" src="./assets/notFound.svg"><div class="emptyListDescription">Oh noes! <br> Your search had no results.</div></div>'

                $('.toReadListContainer').html(toReadListHtml);
            } else {
                var toReadListHtml = toReadListTemplate(toReadArray);

                $('.toReadListContainer').html(toReadListHtml);

                $('.tooltipped').tooltip();
            }
        } else {
            populateToReadList();
        }
    });

}

// Handler for search on currentlyReadingList
function currentlyReadingListSearchHandler() {
    $('.currentlyReadingListSearchBox').on('input', function () {
        var search = $('.currentlyReadingListSearchBox').val().toLowerCase().trim();

        if (removeSpaces(search) != '') {
            var currentlyReadingArray = store.get('currentlyReading');

            currentlyReadingArray = currentlyReadingArray.filter(function (book) {
                if (book.title.toLowerCase().includes(search) || book.author.toLowerCase().includes(search)) {
                    return book;
                } else {
                    for (var i = 0; i < book.tags.length; i++) {
                        if (book.tags[i].toLowerCase().includes(search)) {
                            return book;
                        }
                    }
                }
            });

            if (currentlyReadingArray.length == 0) {
                var currentlyReadingListHtml = '<div class="emptyListContainer center"><img class="emptyListImage emptyNotFoundImage animated pulse" src="./assets/notFound.svg"><div class="emptyListDescription">Oh noes! <br> Your search had no results.</div></div>';

                $('.currentlyReadingListContainer').html(currentlyReadingListHtml);
            } else {
                var currentlyReadingListHtml = currentlyReadingListTemplate(currentlyReadingArray);

                $('.currentlyReadingListContainer').html(currentlyReadingListHtml);

                $('.tooltipped').tooltip();
            }
        } else {
            populateCurrentlyReadingList();
        }
    });
}

// Handler for search on finishedReadingList
function finishedReadingListSearchHandler() {
    $('.finishedReadingListSearchBox').on('input', function () {
        var search = $('.finishedReadingListSearchBox').val().toLowerCase().trim();

        if (removeSpaces(search) != '') {
            var finishedReadingArray = store.get('finishedReading');

            finishedReadingArray = finishedReadingArray.filter(function (book) {
                if (book.title.toLowerCase().includes(search) || book.author.toLowerCase().includes(search)) {
                    return book;
                } else {
                    for (var i = 0; i < book.tags.length; i++) {
                        if (book.tags[i].toLowerCase().includes(search)) {
                            return book;
                        }
                    }
                }
            });

            if (finishedReadingArray.length == 0) {
                var finishedReadingListHtml = '<div class="emptyListContainer center"><img class="emptyListImage emptyNotFoundImage animated pulse" src="./assets/notFound.svg"><div class="emptyListDescription">Oh noes! <br> Your search had no results.</div></div>';

                $('.finishedReadingListContainer').html(finishedReadingListHtml);
            } else {
                var finishedReadingListHtml = finishedReadingListTemplate(finishedReadingArray);

                $('.finishedReadingListContainer').html(finishedReadingListHtml);

                $('.tooltipped').tooltip();
            }
        } else {
            populateFinishedReadingList();
        }
    });
}

// Handler for tagManagerList
function tagManagerListSearchHandler() {
    $('.tagManagerListSearchBox').on('input', function () {
        var search = titleCase($('.tagManagerListSearchBox').val().trim());

        if (removeSpaces(search) != '') {
            var tagArray = store.get('tags');

            tagArray = tagArray.filter(function (tag) {
                if (tag.includes(search)) {
                    return tag;
                }
            });

            var toReadArray = store.get('toRead');

            var currentlyReadingArray = store.get('currentlyReading');

            var finishedReadingArray = store.get('finishedReading');

            var allBooksArray = toReadArray.concat(currentlyReadingArray, finishedReadingArray);

            var finalTagArray = [];

            for (var i = 0; i < tagArray.length; i++) {
                var bookCount = 0;
                var tagName = tagArray[i];

                for (var j = 0; j < allBooksArray.length; j++) {
                    var bookArray = allBooksArray[j].tags.map(tag => titleCase(tag));

                    if (bookArray.includes(titleCase(tagName))) {
                        bookCount += 1;
                    }
                }

                var tagObject = {
                    'name': tagName,
                    'bookCount': bookCount
                }

                finalTagArray.push(tagObject);
            }

            finalTagArray.sort(alphabetizeTagNames);

            if (tagArray.length == 0) {
                var tagManagerListHtml = '<div class="emptyTagManagerListContainer center"><img class="emptyTagManagerListImage animated pulse" src="./assets/notFound.svg"><div class="emptyListDescription">Oh noes! <br> Your search had no results.</div></div>';

                $('.tagManagerListContainer').html(tagManagerListHtml);
            } else {
                var tagManagerListHtml = tagManagerListTemplate(finalTagArray);

                $('.tagManagerListContainer').html(tagManagerListHtml);

                $('.tooltipped').tooltip();
            }
        } else {
            populateTagManagerList();
        }
    });
}

// Handler for search on timeline
function timelineSearchHandler() {
    $('.timelineSearchBtn').click(function () {
        var search = $('.timelineSearch').val().trim().toLowerCase();
        var startDate = $('#startDate').val();
        var endDate = $('#endDate').val();
        var initialTimelineArray = store.get('timeline');
        var timelineArray = initialTimelineArray;

        if (removeSpaces(search) == '' && !startDate && !endDate) {
            M.toast({
                html: 'At least one field is required',
                classes: 'orange'
            });

            animateCSS('.timelineSearchBox', 'bounce');
            animateCSS('#startDate', 'bounce');
            animateCSS('#endDate', 'bounce');
        }


        if (startDate && endDate) {
            startDate = moment($('#startDate').val(), 'MMM DD, YYYY');
            endDate = moment($('#endDate').val(), 'MMM DD, YYYY');

            if (endDate.isBefore(startDate)) {
                M.toast({
                    html: 'End Date is not at least 1 day after Start Date',
                    classes: 'orange'
                });

                animateCSS('#startDate', 'bounce');
                animateCSS('#endDate', 'bounce');

                return;
            }

            if (removeSpaces(search) == '') {
                timelineArray = timelineArray.filter(function (event) {
                    if (moment(event.date).isBetween(startDate, endDate, 'day', '[]')) {
                        return event;
                    }
                });
            } else {
                timelineArray = timelineArray.filter(function (event) {
                    if (moment(event.date).isBetween(startDate, endDate, 'day', '[]') && event.event.toLowerCase().includes(search)) {
                        return event;
                    }
                });
            }
        } else if (startDate && !endDate) {
            if (removeSpaces(search) == '') {
                timelineArray = timelineArray.filter(function (event) {
                    if (moment(event.date).isSameOrAfter(startDate, 'day')) {
                        return event;
                    }
                });
            } else {
                timelineArray = timelineArray.filter(function (event) {
                    if (moment(event.date).isSameOrAfter(startDate, 'day') && event.event.toLowerCase().includes(search)) {
                        return event;
                    }
                });
            }

        } else if (!startDate && endDate) {
            if (removeSpaces(search) == '') {
                timelineArray = timelineArray.filter(function (event) {
                    if (moment(event.date).isSameOrBefore(endDate, 'day')) {
                        return event;
                    }
                });
            } else {
                timelineArray = timelineArray.filter(function (event) {
                    if (moment(event.date).isSameOrBefore(endDate, 'day') && event.event.toLowerCase().includes(search)) {
                        return event;
                    }
                });
            }
        } else if (removeSpaces(search) != '') {
            timelineArray = timelineArray.filter(function (event) {
                if (event.event.toLowerCase().includes(search.toLowerCase())) {
                    return event;
                }
            });
        }

        if (timelineArray.length < 1) {
            M.toast({
                html: 'No results',
                classes: 'orange'
            });

            timelineArray = initialTimelineArray;
        }

        timelineArray.map(function (event) {
            var formattedDate = moment(event.date).format('llll');
            event.date = formattedDate;

            return event;
        })

        var timelineHtml = timelineTemplate(timelineArray);

        $('.timeline').html(timelineHtml);
    });

    $('.timelineClearBtn').click(function () {
        $('.timelineSearch').val('');

        var elems = document.querySelector('#startDate');
        var instances = M.Datepicker.init(elems, {});

        var elems = document.querySelector('#endDate');
        var instances = M.Datepicker.init(elems, {});

        $('#startDate').val('');
        $('#endDate').val('');

        animateCSS('.timelineSearchBox', 'bounce');
        animateCSS('#startDate', 'bounce');
        animateCSS('#endDate', 'bounce');

        populateTimeline();
    });
}

// Handler for new tag form CHECK FOR UNSUBMITTED
function newTagFormHandler() {
    $('.newTagSubmitBtn').click(function () {
        var tag = titleCase($('#newTag').val());

        var bookChipsInstance = M.Chips.getInstance($('.addBooksChips'));

        var bookChipsArray = bookChipsInstance.chipsData;

        var tagArray = store.get('tags');

        if (!removeSpaces(tag)) {
            animateCSS('#newTag', 'bounce');

            M.toast({
                html: 'No tag specified',
                classes: 'orange'
            });
        } else if (tagArray.includes(tag)) {
            animateCSS('#newTag', 'bounce');

            M.toast({
                html: 'Tag already exists',
                classes: 'orange'
            });
        } else if ($('.addBooksChips input').val()) {
            M.toast({
                html: 'Please check that your books are registered',
                classes: 'orange'
            });
        } else {
            if (bookChipsArray.length > 0) {
                bookChipsArray = bookChipsArray.map(function (chip) {
                    return chip.tag.toLowerCase();
                });

                var toReadArray = store.get('toRead');

                var currentlyReadingArray = store.get('currentlyReading');

                var finishedReadingArray = store.get('finishedReading');

                var allBooksArray = [{
                        'toRead': toReadArray
                    },
                    {
                        'currentlyReading': currentlyReadingArray
                    },
                    {
                        'finishedReading': finishedReadingArray
                    }
                ];

                for (var i = 0; i < allBooksArray.length; i++) {
                    for (var j = 0; j < allBooksArray[i][Object.keys(allBooksArray[i])[0]].length; j++) {
                        if (bookChipsArray.length != 0) {
                            var categoryArray = allBooksArray[i][Object.keys(allBooksArray[i])[0]];

                            var categoryBook = categoryArray[j];

                            if (bookChipsArray.includes(categoryBook.title.toLowerCase())) {
                                categoryBook.tags.push(tag);

                                categoryBook.tags.sort();

                                allBooksArray[i][Object.keys(allBooksArray[i])[0]][j] = categoryBook;

                                bookChipsArray = bookChipsArray.filter(function (book) {
                                    if (book != categoryBook.title) {
                                        return book;
                                    }
                                })
                            }
                        } else {
                            break;
                        }
                    }
                }

                store.set('toRead', allBooksArray[0].toRead);

                store.set('currentlyReading', allBooksArray[1].currentlyReading);

                store.set('finishedReading', allBooksArray[2].finishedReading);
            }

            tagArray.push(tag);

            tagArray.sort();

            store.set('tags', tagArray);

            $('#newTagModal').modal('close');

            M.toast({
                html: 'Tag Added',
                classes: 'green'
            });

            populateTagManagerList();
        }
    });
}

// Checks if duplicate or faulty book chips have been added (CHECK THIS)
function validateBookChip() {
    var bookChipsInstance = M.Chips.getInstance($('.addBooksChips'));

    var lastBookChipIndex = bookChipsInstance.chipsData.length - 1;

    var bookChipsArray = bookChipsInstance.chipsData;

    var lastBookTitle = bookChipsArray[lastBookChipIndex].tag.toLowerCase();

    var toReadArray = store.get('toRead');

    var currentlyReadingArray = store.get('currentlyReading');

    var finishedReadingArray = store.get('finishedReading');

    var allBooksArray = toReadArray.concat(currentlyReadingArray, finishedReadingArray);

    bookChipsArray = bookChipsArray.map(function (book) {
        return book.tag.toLowerCase();
    });

    if (bookChipsArray.length === new Set(bookChipsArray).size && bookChipsArray.length > 1) {
        bookChipsInstance.deleteChip(lastBookChipIndex);

        M.toast({
            html: 'Book already added',
            classes: 'orange'
        });
    } else if (!(allBooksArray.filter(book => book.title.toLowerCase() === lastBookTitle).length > 0)) {
        bookChipsInstance.deleteChip(lastBookChipIndex);

        M.toast({
            html: 'Book does not exist',
            classes: 'orange'
        });
    }
}

// Populates book select on new tag form
function populateBookSelect() {
    var toReadArray = store.get('toRead');

    var currentlyReadingArray = store.get('currentlyReading');

    var finishedReadingArray = store.get('finishedReading');

    var allBooksArray = toReadArray.concat(currentlyReadingArray, finishedReadingArray);

    var booksAutocompleteObject = {};

    allBooksArray.sort(function (a, b) {
        var textA = a.title;
        var textB = b.title;
        return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });

    for (var i = 0; i < allBooksArray.length; i++) {
        booksAutocompleteObject[allBooksArray[i].title] = null;
    }

    $('.addBooksChips').chips({
        placeholder: 'Tag Books',
        secondaryPlaceholder: '+Book',
        onChipAdd: validateBookChip,
        autocompleteOptions: {
            data: booksAutocompleteObject,
            limit: 10
        }
    });
}

// Fixes positioning of book select in newTagModal
function newTagModalFix() {
    $('#newTagModal').css('display', 'inline-table');
}

// Alphabetizes tag names
function alphabetizeTagNames(a, b) {
    if (a.name < b.name) {
        return -1;
    }
    if (a.name > b.name) {
        return 1;
    }
    return 0;
}

// Populates tagManagerList
function populateTagManagerList() {
    var tagArray = store.get('tags');

    var toReadArray = store.get('toRead');

    var currentlyReadingArray = store.get('currentlyReading');

    var finishedReadingArray = store.get('finishedReading');

    var allBooksArray = toReadArray.concat(currentlyReadingArray, finishedReadingArray);

    var finalTagArray = [];

    for (var i = 0; i < tagArray.length; i++) {
        var bookCount = 0;
        var tagName = tagArray[i];

        for (var j = 0; j < allBooksArray.length; j++) {
            var bookArray = allBooksArray[j].tags.map(tag => titleCase(tag));

            if (bookArray.includes(titleCase(tagName))) {
                bookCount += 1;
            }
        }

        var tagObject = {
            'name': tagName,
            'bookCount': bookCount
        }

        finalTagArray.push(tagObject);
    }

    finalTagArray.sort(alphabetizeTagNames);

    tagManagerListHtml = tagManagerListTemplate(finalTagArray);

    $('.tagManagerListContainer').html(tagManagerListHtml);

    $('.tooltipped').tooltip();
}

// Creating a custom function on Array object to subtract two arrays
Array.prototype.diff = function (a) {
    return this.filter(function (i) {
        return a.indexOf(titleCase(i)) < 0;
    });
};

// Button handlers for tagManagerList
function tagManagerListBtnHandlers() {
    $(document).on('click', '.deleteTagToastBtn', function () {
        var deleteToastHTML = '<span>Confirm Delete?</span><a data-tag="' + $(this).data('tag') + '" class="deleteTagBtn btn-floating toast-action green"><i class="material-icons white-text">done</i></a>';
        M.toast({
            html: deleteToastHTML,
            classes: 'red'
        });
    });

    $(document).on('click', '.deleteTagBtn', function () {
        var toastElement = $(this).parent();
        var toastInstance = M.Toast.getInstance(toastElement);
        toastInstance.dismiss();

        var targetTag = $(this).data('tag');

        var tagArray = store.get('tags');

        tagArray = tagArray.filter(function (tag) {
            if (tag !== targetTag) {
                return tag;
            }
        });

        store.set('tags', tagArray);

        var toReadArray = store.get('toRead');

        var currentlyReadingArray = store.get('currentlyReading');

        var finishedReadingArray = store.get('finishedReading');

        var allBooksArray = [{
                'toRead': toReadArray
            },
            {
                'currentlyReading': currentlyReadingArray
            },
            {
                'finishedReading': finishedReadingArray
            }
        ];

        for (var i = 0; i < allBooksArray.length; i++) {
            for (var j = 0; j < allBooksArray[i][Object.keys(allBooksArray[i])[0]].length; j++) {
                var categoryArray = allBooksArray[i][Object.keys(allBooksArray[i])[0]];

                var categoryBook = categoryArray[j];

                categoryBook.tags = categoryBook.tags.filter(function (tag) {
                    if (tag !== targetTag) {
                        return tag;
                    }
                });

                categoryBook.tags.sort();

                allBooksArray[i][Object.keys(allBooksArray[i])[0]][j] = categoryBook;
            }
        }

        store.set('toRead', allBooksArray[0].toRead);

        store.set('currentlyReading', allBooksArray[1].currentlyReading);

        store.set('finishedReading', allBooksArray[2].finishedReading);

        populateTagManagerList();

        M.toast({
            html: 'Removed Tag',
            classes: 'green'
        });
    });
}

// Button handlers for finishedReading books
function finishedReadingBookBtnHandlers() {
    $(document).on('click', '.deleteFinishedReadingBookBtn', function () {
        var toastElement = $(this).parent();
        var toastInstance = M.Toast.getInstance(toastElement);
        toastInstance.dismiss();

        var targetUuid = $(this).data('uuid');
        var finishedReadingArray = store.get('finishedReading');

        finishedReadingArray = finishedReadingArray.filter(function (book) {
            return book.uuid !== targetUuid;
        });

        store.set('finishedReading', finishedReadingArray);

        var today = moment(new Date());

        var title = $('.finishedReadingBookTitle[data-uuid=' + targetUuid + ']').text();

        var timelineEntry = {
            'event': 'Removed: ' + title,
            'date': today,
            'icon': {
                'name': 'delete',
                'color': 'red'
            }
        }

        var timelineArray = store.get('timeline');

        timelineArray.unshift(timelineEntry);

        store.set('timeline', timelineArray);

        populateFinishedReadingList();

        finishedBooksWidget();

        filterTotalFinishedBooksWidget();

        M.toast({
            html: 'Removed Book',
            classes: 'green'
        });
    });

    $(document).on('click', '.deleteFinishedReadingToastBtn', function () {
        var deleteToastHTML = '<span>Confirm Delete?</span><a data-uuid="' + $(this).data('uuid') + '" class="deleteFinishedReadingBookBtn btn-floating toast-action green"><i class="material-icons white-text">done</i></a>';
        M.toast({
            html: deleteToastHTML,
            classes: 'red'
        });
    });

    $(document).on('click', '.infoFinishedReadingBookBtn', function () {
        var targetUuid = $(this).data('uuid');

        var finishedReadingArray = store.get('finishedReading');

        var targetBook = {};

        finishedReadingArray = finishedReadingArray.filter(function (book) {
            if (book.uuid == targetUuid) {
                targetBook = book;
            }

            return book.uuid !== targetUuid;
        });

        targetBook.dateAdded = moment(targetBook.dateAdded).format('llll');
        targetBook.dateStarted = moment(targetBook.dateStarted).format('llll');
        targetBook.dateFinished = moment(targetBook.dateFinished).format('llll');

        if (!targetBook.notes) {
            targetBook.notes = "No Additional Notes";
        }

        var infoFinishedReadingHtml = infoFinishedReadingTemplate(targetBook);

        $('.infoFinishedReadingWrapper').html(infoFinishedReadingHtml);

        undoNotes();
        editNotesChanged();

        $('.tooltipped').tooltip();

        $('#infoFinishedReadingBookModal').modal('open');
    });
}

// Button handlers for currentlyReading books
function currentlyReadingBookBtnHandlers() {
    $(document).on('click', '.addToFinishedReadingToastBtn', function () {
        var addToastHTML = '<span>Confirm Action?</span><a data-uuid="' + $(this).data('uuid') + '" class="addToFinishedReadingBtn btn-floating toast-action green"><i class="material-icons white-text">done</i></a>';
        M.toast({
            html: addToastHTML,
            classes: 'orange'
        });
    });

    $(document).on('click', '.addToFinishedReadingBtn', function () {
        var toastElement = $(this).parent();
        var toastInstance = M.Toast.getInstance(toastElement);
        toastInstance.dismiss();

        var targetUuid = $(this).data('uuid');

        var currentlyReadingArray = store.get('currentlyReading');

        var targetBook = {};

        currentlyReadingArray = currentlyReadingArray.filter(function (book) {
            if (book.uuid == targetUuid) {
                targetBook = book;
            }

            return book.uuid !== targetUuid;
        });

        store.set('currentlyReading', currentlyReadingArray);

        var today = moment(new Date());

        targetBook = {
            "uuid": targetBook.uuid,
            "title": targetBook.title,
            "author": targetBook.author,
            "tags": targetBook.tags,
            "notes": targetBook.notes,
            "dateAdded": targetBook.dateAdded,
            "dateStarted": targetBook.dateStarted,
            "dateFinished": today
        }

        var finishedReadingArray = store.get('finishedReading');

        finishedReadingArray.unshift(targetBook);

        store.set('finishedReading', finishedReadingArray);

        var timelineEntry = {
            'event': 'Finished: ' + targetBook.title,
            'date': today,
            'icon': {
                'name': 'done',
                'color': 'blue'
            }
        }

        var timelineArray = store.get('timeline');

        timelineArray.unshift(timelineEntry);

        store.set('timeline', timelineArray);

        populateCurrentlyReadingList();

        populateFinishedReadingList();

        finishedBooksWidget();

        filterTotalFinishedBooksWidget();

        M.toast({
            html: 'Moved Book',
            classes: 'green'
        });
    });

    $(document).on('click', '.deleteCurrentlyReadingBookBtn', function () {
        var toastElement = $(this).parent();
        var toastInstance = M.Toast.getInstance(toastElement);
        toastInstance.dismiss();

        var targetUuid = $(this).data('uuid');
        var currentlyReadingArray = store.get('currentlyReading');

        currentlyReadingArray = currentlyReadingArray.filter(function (book) {
            return book.uuid !== targetUuid;
        });

        store.set('currentlyReading', currentlyReadingArray);

        var today = moment(new Date());

        var title = $('.currentlyReadingBookTitle[data-uuid=' + targetUuid + ']').text();

        var timelineEntry = {
            'event': 'Removed: ' + title,
            'date': today,
            'icon': {
                'name': 'delete',
                'color': 'red'
            }
        }

        var timelineArray = store.get('timeline');

        timelineArray.unshift(timelineEntry);

        store.set('timeline', timelineArray);

        populateCurrentlyReadingList();

        M.toast({
            html: 'Removed Book',
            classes: 'green'
        });
    });

    $(document).on('click', '.deleteCurrentlyReadingToastBtn', function () {
        var deleteToastHTML = '<span>Confirm Delete?</span><a data-uuid="' + $(this).data('uuid') + '" class="deleteCurrentlyReadingBookBtn btn-floating toast-action green"><i class="material-icons white-text">done</i></a>';
        M.toast({
            html: deleteToastHTML,
            classes: 'red'
        });
    });

    $(document).on('click', '.infoCurrentlyReadingBookBtn', function () {
        var targetUuid = $(this).data('uuid');

        var currentlyReadingArray = store.get('currentlyReading');

        var targetBook = {};

        currentlyReadingArray = currentlyReadingArray.filter(function (book) {
            if (book.uuid == targetUuid) {
                targetBook = book;
            }

            return book.uuid !== targetUuid;
        });

        targetBook.dateAdded = moment(targetBook.dateAdded).format('llll');
        targetBook.dateStarted = moment(targetBook.dateStarted).format('llll');

        // if (!targetBook.notes) {
        //     targetBook.notes = "No Additional Notes";
        // }

        var infoCurrentlyReadingHtml = infoCurrentlyReadingTemplate(targetBook);

        $('.infoCurrentlyReadingWrapper').html(infoCurrentlyReadingHtml);

        undoNotes();
        editNotesChanged();

        $('.tooltipped').tooltip();

        $('#infoCurrentlyReadingBookModal').modal('open');
    });
}

// Button handlers for toRead books
function toReadBookBtnHandlers() {
    $(document).on('click', '.deleteToReadBookBtn', function () {
        var toastElement = $(this).parent();
        var toastInstance = M.Toast.getInstance(toastElement);
        toastInstance.dismiss();

        var targetUuid = $(this).data('uuid');
        var toReadArray = store.get('toRead');

        toReadArray = toReadArray.filter(function (book) {
            return book.uuid !== targetUuid;
        });

        store.set('toRead', toReadArray);

        var today = moment(new Date());

        var title = $('.toReadBookTitle[data-uuid=' + targetUuid + ']').text();

        var timelineEntry = {
            'event': 'Removed: ' + title,
            'date': today,
            'icon': {
                'name': 'delete',
                'color': 'red'
            }
        }

        var timelineArray = store.get('timeline');

        timelineArray.unshift(timelineEntry);

        store.set('timeline', timelineArray);

        populateToReadList();

        M.toast({
            html: 'Removed Book',
            classes: 'green'
        });
    });

    $(document).on('click', '.deleteToReadBookToastBtn', function () {
        var deleteToastHTML = '<span>Confirm Delete?</span><a data-uuid="' + $(this).data('uuid') + '" class="deleteToReadBookBtn btn-floating toast-action green"><i class="material-icons white-text">done</i></a>';
        M.toast({
            html: deleteToastHTML,
            classes: 'red'
        });
    });

    $(document).on('click', '.addToCurrentlyReadingBtn', function () {
        var toastElement = $(this).parent();
        var toastInstance = M.Toast.getInstance(toastElement);
        toastInstance.dismiss();

        var targetUuid = $(this).data('uuid');

        var toReadArray = store.get('toRead');

        var targetBook = {};

        toReadArray = toReadArray.filter(function (book) {
            if (book.uuid == targetUuid) {
                targetBook = book;
            }

            return book.uuid !== targetUuid;
        });

        store.set('toRead', toReadArray);

        var today = moment(new Date());

        targetBook = {
            "uuid": targetBook.uuid,
            "title": targetBook.title,
            "author": targetBook.author,
            "tags": targetBook.tags,
            "notes": targetBook.notes,
            "dateAdded": targetBook.dateAdded,
            "dateStarted": today
        }

        var currentlyReadingArray = store.get('currentlyReading');

        currentlyReadingArray.unshift(targetBook);

        store.set('currentlyReading', currentlyReadingArray);

        var timelineEntry = {
            'event': 'Reading: ' + targetBook.title,
            'date': today,
            'icon': {
                'name': 'book',
                'color': 'red'
            }
        }

        var timelineArray = store.get('timeline');

        timelineArray.unshift(timelineEntry);

        store.set('timeline', timelineArray);

        populateToReadList();

        populateCurrentlyReadingList();

        M.toast({
            html: 'Moved Book',
            classes: 'green'
        });
    });

    $(document).on('click', '.addToCurrentlyReadingToastBtn', function () {
        var addToastHTML = '<span>Confirm Action?</span><a data-uuid="' + $(this).data('uuid') + '" class="addToCurrentlyReadingBtn btn-floating toast-action green"><i class="material-icons white-text">done</i></a>';
        M.toast({
            html: addToastHTML,
            classes: 'orange'
        });
    });

    $(document).on('click', '.editBookBtn', function () {
        var targetUuid = $(this).data('uuid');
        var toReadArray = store.get('toRead');

        var targetBook = toReadArray.filter(book => {
            return book.uuid == targetUuid;
        })[0];

        $('#editTitle').val(targetBook.title);
        $('#editAuthor').val(targetBook.author);
        $('#editBookUuid').val(targetBook.uuid);

        if (targetBook.tags) {
            var selectedTags = targetBook.tags;

            var allTags = store.get('tags');

            var unselectedTags = allTags.diff(selectedTags);

            var combinedTags = {
                'selectedTags': selectedTags,
                'unselectedTags': unselectedTags
            }

            var editTagSelectHtml = editTagSelectTemplate(combinedTags);

            $('#disabledEditTag').after(editTagSelectHtml);

            $('select').formSelect();
        }

        if (targetBook.notes) {
            $('#editNotes').val(targetBook.notes);
        }

        $('#editBookModal').modal('open');
    });
}

// Checks if JSON is parsable
function tryParseJSON(jsonString) {
    try {
        var jsonObject = JSON.parse(jsonString);

        if (jsonObject && typeof jsonObject === "object") {
            return jsonObject;
        }
    } catch (error) {}

    return false;
};

// Checks if JSON is in Readit's appropriate format
function isReaditJSON(jsonObject) {
    var requiredKeysArray = [
        'startDate',
        'timeline',
        'tags',
        'toRead',
        'currentlyReading',
        'finishedReading'
    ];

    for (var i = 0; i < requiredKeysArray.length; i++) {
        if (!jsonObject.hasOwnProperty(requiredKeysArray[i])) {
            return false;
        }
    }

    return true;
}

// Button handlers for settings
function settingsBtnHandlers() {
    $('.uploadBtn').click(function () {
        var reader = new FileReader();

        reader.onload = function (e) {
            var text = reader.result;

            if (tryParseJSON(text) && isReaditJSON(tryParseJSON(text))) {
                var jsonObject = tryParseJSON(text);

                store.set(jsonObject);

                populateToReadList();
                populateCurrentlyReadingList();
                populateFinishedReadingList();

                daysSinceStartWidget();
                finishedBooksWidget();
                filterTotalFinishedBooksWidget();

                M.toast({
                    html: 'Imported new data',
                    classes: 'green'
                });
            } else {
                M.toast({
                    html: 'Invalid JSON',
                    classes: 'orange'
                });
            }
        }

        try {
            reader.readAsText($('#uploadFile').prop('files')[0]);
        } catch (error) {
            M.toast({
                html: 'Invalid JSON',
                classes: 'orange'
            });
        }
    });

    ipcRenderer.on("downloadJSONComplete", (event, file) => {
        M.toast({
            html: 'Downloaded file to ' + file,
            classes: 'green'
        });
    });

    $('.downloadBtn').click(function () {
        ipcRenderer.send("downloadJSON", {
            url: store.path
        });
    });

    $('#resetName').on('input', function () {
        var resetName = $(this).val().trim();

        if (resetName.toLowerCase() == "readit") {
            $('.resetBtn').removeClass('disabled');
        } else {
            $('.resetBtn').addClass('disabled');
        }
    });

    $('.resetBtn').click(function () {
        var today = moment(new Date());

        store.set({
            "startDate": today,
            "timeline": [{
                "event": "Started using Readit",
                "date": today,
                "icon": {
                    "name": "flag",
                    "color": "rainbow pulse"
                }
            }],
            "tags": [],
            "toRead": [],
            "currentlyReading": [],
            "finishedReading": []
        });

        $('#resetModal').modal('close');

        populateToReadList();
        populateCurrentlyReadingList();
        populateFinishedReadingList();

        daysSinceStartWidget();
        finishedBooksWidget();
        filterTotalFinishedBooksWidget();

        M.toast({
            html: 'All data has been reset',
            classes: 'green'
        });
    });
}

// Creates an obfuscation effect (Spent way too much time on this)
function obfuscateEffect() {
    var obfuscateInterval;
    var initialText = $('.obfuscate').text();

    $('.obfuscate').hover(function () {
        obfuscateInterval = setInterval(animateObfuscatedText, 25);
    }, function () {
        clearInterval(obfuscateInterval);
        $('.obfuscate').text(initialText);
    });

    function animateObfuscatedText() {
        var text = $('.obfuscate').text();

        var alphabet = [
            "",
            "i,;.:!|î",
            "l'`Ììí·´",
            "It[]ÍÎÏïªº•°",
            " kf(){}*¤²”\"",
            "ABCDEFGHJKLMNOPQRSTUVWXYZabcdeghjmnopqrsuvwxyz" +
            "/?$%&+-#_¯=^¨£ÀÁÂÃÄÅÇÈÉÊËÑÒÓÔÕÖÙÚÛÜÝ" +
            "àáâãäåçèéêëñðòóôõöùúûüýÿ0123456789Ææß×¼½¿¬«»",
            "~@®÷±",
            "µµµµµ",
        ];

        var newText = "";

        for (var i = 0; i < text.length; i++) {
            var newCharacter = text[i];

            var length = -1;
            var position = -1;

            for (var j = 1; j < alphabet.length; j++) {
                for (var k = 0; k < alphabet[j].length; k++) {
                    if (alphabet[j][k] == newCharacter) {
                        length = j;
                        position = k;
                        break;
                    }
                }
                if (length >= 0)
                    break;
            }

            if (length >= 0) {
                var newPosition;
                do {
                    newPosition = Math.floor(Math.random() * alphabet[length].length);
                }
                while (newPosition == position);

                newText += alphabet[length][newPosition];
            } else
                newText += newCharacter;
        }

        $('.obfuscate').text(newText);
    }
}

// Changes profile image to a gif on hover
function animateProfileImage() {
    $('.profileImage').mouseenter(function () {
        $('.profileImage').attr('src', 'assets/profile.gif');
    });

    $('.profileImage').mouseleave(function () {
        $('.profileImage').attr('src', 'assets/profile.png');
    })
}

// Button handlers for socials
function socialBtnHandlers() {
    $('.linkedin').click(function () {
        open("https://www.linkedin.com/in/sohamashodiya/");
    });

    $('.github').click(function () {
        open("https://github.com/sohamashodiya");
    });

    $('.discord').click(function () {
        clipboard.writeText('Vell•सोहम•eity#3427');

        M.toast({
            html: 'Copied Discord ID',
            classes: 'green'
        });
    });

    $('.twitter').click(function () {
        open("https://twitter.com/sohamashodiya");
    });
}

$(document).ready(function () {
    initializeMaterializeWidgets();
    initializeHandlebarsTemplates();
    daysSinceStartWidget();
    finishedBooksWidget();
    filterTotalFinishedBooksWidget();
    isbnHandler();
    newTagFormHandler();
    newBookFormHandler();
    editBookFormHandler();
    editNotesHandler();
    populateToReadList();
    populateCurrentlyReadingList();
    populateFinishedReadingList();
    toReadListSearchHandler();
    currentlyReadingListSearchHandler();
    finishedReadingListSearchHandler();
    toReadBookBtnHandlers();
    currentlyReadingBookBtnHandlers();
    finishedReadingBookBtnHandlers();
    tabHandlers();
    timelineSearchHandler();
    tagManagerListSearchHandler()
    tagManagerListBtnHandlers();
    settingsBtnHandlers();
    socialBtnHandlers();

    animateProfileImage();
    obfuscateEffect();
});
