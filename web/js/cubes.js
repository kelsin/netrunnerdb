$(document).on("data.app", function () {
    $("#btn-group-cube").on("click", "button[id],a[id]", do_action_cube);
    $("#btn-group-selection").on(
        "click",
        "button[id],a[id]",
        do_action_selection,
    );
    $("#btn-group-sort").on("click", "button[id],a[id]", do_action_sort);
    $("#cubes_upload_all").on("click", cubes_upload_all);
    $("#select_all").on("click", select_all_visible);
    $("#deselect_all").on("click", deselect_all);

    $("#menu-sort").on(
        {
            change: function (event) {
                if (
                    $(this)
                        .attr("id")
                        .match(/btn-sort-(\w+)/)
                ) {
                    DisplaySort = RegExp.$1;
                    update_cube();
                }
            },
        },
        "a",
    );

    $("#tag_toggles").on("click", "button", function (event) {
        var button = $(this);
        if (!event.shiftKey) {
            $("#tag_toggles button").each(function (index, elt) {
                if ($(elt).text() != button.text())
                    $(elt).removeClass("active");
            });
        }
        setTimeout(filter_cubes, 0);
    });
    update_tag_toggles();

    // Selects a cube with its checkbox
    $("a.cube-list-group-item :checkbox").change(function (event) {
        let cube = $(`#cube_${$(this).val()}`);
        if (this.checked) {
            LastClickedCube = cube;
            select_cube(cube);
        } else {
            deselect_cube(cube);
        }
    });
    // Ensures the checkbox isn't blocked by the cubelist-expanding event
    $("body").on("click", "a.cube-list-group-item :checkbox", function (event) {
        event.stopPropagation();
    });

    // Expands a cubelist by clicking anywhere else on it
    $("body").on("click", "a.cube-list-group-item", function (event) {
        LastClickedCube = this;
        show_cube();
    });
    // Close a cube by clicking on its exit button while its expanded
    $("body").on(
        "click",
        "a.cube-list-group-item #close_cube",
        function (event) {
            hide_cube();
            event.stopPropagation();
        },
    );
    // Expand/close a cube with the keyboard
    $(".cubes").keydown(function (event) {
        if (event.which == 27) {
            // Escape
            hide_cube();
        }
        if (event.which == 13) {
            // Enter
            show_cube();
        }
        return false;
    });

    // On load, reset all cube with checked checkboxes as selected
    $("a.cube-list-group-item :checkbox").each(function (i, e) {
        if ($(this).is(":checked")) select_cube($(`#cube_${$(this).val()}`));
    });
});

function select_cube(obj) {
    obj.addClass("selected");
    obj.find(":checkbox").prop("checked", true);
}

function deselect_cube(obj) {
    obj.removeClass("selected");
    obj.find(":checkbox").prop("checked", false);
}

function select_all_visible() {
    $("a.cube-list-group-item").each(function (i, e) {
        if ($(this).is(":visible")) {
            select_cube($(this));
        }
    });
}

function deselect_all() {
    $("a.cube-list-group-item").each(function (i, e) {
        deselect_cube($(this));
    });
}

function cubes_upload_all() {
    $("#archiveModal").modal("show");
}

function get_card_list_item_html(card, quantity) {
    return (
        "<li>" +
        quantity +
        "x " +
        card.title +
        ' (<span class="small icon icon-' +
        card.pack.cycle.code +
        '"></span> ' +
        card.position +
        ")</li>"
    );
}

function do_diff(uuids) {
    if (uuids.length < 2) return;

    var contents = [];
    var names = [];
    for (var cubenum = 0; cubenum < uuids.length; cubenum++) {
        var cube = _.find(Cubes, function (acube) {
            return acube.uuid == uuids[cubenum];
        });
        var hash = {};
        for (var slotnum = 0; slotnum < cube.cards.length; slotnum++) {
            var slot = cube.cards[slotnum];
            hash[slot.card_code] = slot.qty;
        }
        contents.push(hash);
        names.push(cube.name);
    }

    var diff = NRDB.diff.compute_simple(contents);
    var listings = diff[0];
    var intersect = diff[1];

    var container = $("#diff_content");
    container.empty();
    container.append("<h4>Cards in all cubes</h4>");
    var list = $("<ul></ul>").appendTo(container);
    var item_data = $.map(intersect, function (qty, card_code) {
        var card = NRDB.data.cards.findById(card_code);
        if (card) return { card: card, qty: qty };
    }).sort(function (a, b) {
        return a.card.title.localeCompare(b.card.title);
    });
    $.each(item_data, function (index, item) {
        list.append(get_card_list_item_html(item.card, item.qty));
    });

    for (var i = 0; i < listings.length; i++) {
        container.append("<h4>Cards only in <b>" + names[i] + "</b></h4>");
        var list = $("<ul></ul>").appendTo(container);
        var item_data = $.map(listings[i], function (qty, card_code) {
            var card = NRDB.data.cards.findById(card_code);
            if (card) return { card: card, qty: qty };
        }).sort(function (a, b) {
            return a.card.title.localeCompare(b.card.title);
        });
        $.each(item_data, function (index, item) {
            list.append(get_card_list_item_html(item.card, item.qty));
        });
    }
    $("#diffModal").modal("show");
}

function do_diff_collection(uuids) {
    if (uuids.length < 2) return;
    var cubes;
    cubes = [];

    var ensembles;
    ensembles = [];
    var lengths;
    lengths = [];
    for (var cubenum = 0; cubenum < uuids.length; cubenum++) {
        var cube = _.find(Cubes, function (acube) {
            return acube.uuid == uuids[cubenum];
        });
        cubes.push(cube);
        var cards = [];
        for (var slotnum = 0; slotnum < cube.cards.length; slotnum++) {
            var slot = cube.cards[slotnum];
            for (var copynum = 0; copynum < slot.qty; copynum++) {
                cards.push(slot.card_code);
            }
        }
        ensembles.push(cards);
        lengths.push(cards.length);
    }

    var imax = 0;
    for (var i = 0; i < lengths.length; i++) {
        if (lengths[imax] < lengths[i]) imax = i;
    }
    var collection = ensembles.splice(imax, 1);
    var rest = [];
    for (var i = 0; i < ensembles.length; i++) {
        rest = rest.concat(ensembles[i]);
    }
    ensembles = [collection[0], rest];
    var names = [cubes[imax].name, "The rest"];

    var conjunction = [];
    for (var i = 0; i < ensembles[0].length; i++) {
        var code = ensembles[0][i];
        var indexes = [i];
        for (var j = 1; j < ensembles.length; j++) {
            var index = ensembles[j].indexOf(code);
            if (index > -1) indexes.push(index);
            else break;
        }
        if (indexes.length === ensembles.length) {
            conjunction.push(code);
            for (var j = 0; j < indexes.length; j++) {
                ensembles[j].splice(indexes[j], 1);
            }
            i--;
        }
    }

    var listings = [];
    for (var i = 0; i < ensembles.length; i++) {
        listings[i] = array_count(ensembles[i]);
    }
    var intersect = array_count(conjunction);

    var container = $("#diff_content");
    container.empty();
    container.append("<h4>Cards in all cubes</h4>");
    var list = $("<ul></ul>").appendTo(container);
    $.each(intersect, function (card_code, qty) {
        var card = NRDB.data.cards.findById(card_code);
        if (card) list.append(get_card_list_item_html(card, qty));
    });

    for (var i = 0; i < listings.length; i++) {
        container.append("<h4>Cards only in <b>" + names[i] + "</b></h4>");
        var list = $("<ul></ul>").appendTo(container);
        $.each(listings[i], function (card_code, qty) {
            var card = NRDB.data.cards.findById(card_code);
            if (card) list.append(get_card_list_item_html(card, qty));
        });
    }
    $("#diffModal").modal("show");
}

// takes an array of strings and returns an object where each string of the array
// is a key of the object and the value is the number of occurences of the string in the array
function array_count(list) {
    var obj = {};
    var list = list.sort();
    for (var i = 0; i < list.length; ) {
        for (var j = i + 1; j < list.length; j++) {
            if (list[i] !== list[j]) break;
        }
        obj[list[i]] = j - i;
        i = j;
    }
    return obj;
}

function filter_cubes() {
    var buttons = $("#tag_toggles button.active");
    var list_id = [];
    buttons.each(function (index, button) {
        list_id = list_id.concat($(button).data("cube_uuid").split(/\s+/));
    });
    list_id = list_id.filter(function (itm, i, a) {
        return i == a.indexOf(itm);
    });
    $("#cubes a.cube-list-group-item").each(function (index, elt) {
        deselect_cube($(elt));
        var uuid = $(elt).attr("id").replace("cube_", "");
        if (list_id.length && list_id.indexOf(uuid) === -1) $(elt).hide();
        else $(elt).show();
    });
}

function do_action_cube(event) {
    event.stopPropagation();
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
        return;
    var cube_uuid = $(this).closest(".cube-list-group-item").data("uuid");
    var cube = (SelectedCube = _.find(Cubes, function (cube) {
        return cube.uuid == cube_uuid;
    }));
    if (!cube) return;
    var action_id = $(this).attr("id");
    if (!action_id) return;
    switch (action_id) {
        case "btn-view":
            location.href = Routing.generate("cube_view", {
                cube_uuid: cube.uuid,
                _locale: NRDB.locale,
            });
            break;
        case "btn-edit":
            location.href = Routing.generate("cube_edit", {
                cube_uuid: cube.uuid,
                _locale: NRDB.locale,
            });
            break;
        case "btn-publish":
            show_publish_cube_form(cube.uuid, cube.name, cube.description);
            break;
        case "btn-duplicate":
            location.href = Routing.generate("cube_duplicate", {
                cube_uuid: cube.uuid,
                _locale: NRDB.locale,
            });
            break;
        case "btn-delete":
            confirm_delete(cube);
            break;
        case "btn-download-text":
            location.href = Routing.generate("cube_export_text", {
                cube_uuid: cube.uuid,
                _locale: NRDB.locale,
            });
            break;
        case "btn-export-tournament-sheet":
            open_cubelist_modal(cube.uuid);
            break;
        case "btn-export-bbcode":
            export_bbcode(cube);
            break;
        case "btn-export-markdown":
            export_markdown(cube);
            break;
        case "btn-export-plaintext":
            export_plaintext(cube);
            break;
        case "btn-pnp":
            location.href = Routing.generate("cube_print", {
                cube_uuid: cube.uuid,
                _locale: NRDB.locale,
            });
            break;
    }
    return false;
}

function do_action_selection(event) {
    var action_id = $(this).attr("id");
    var uuids = [];
    $("#cubes a.cube-list-group-item.selected").each(function (index, elt) {
        uuids.push($(elt).data("uuid"));
    });
    if (!action_id || !uuids.length) return;
    switch (action_id) {
        case "btn-compare":
            do_diff(uuids);
            break;
        case "btn-compare-collection":
            do_diff_collection(uuids);
            break;
        case "btn-tag-add":
            tag_add(uuids);
            break;
        case "btn-tag-remove-one":
            tag_remove(uuids);
            break;
        case "btn-tag-remove-all":
            tag_clear(uuids);
            break;
        case "btn-delete-selected":
            confirm_delete_all(uuids);
            break;
    }
    return;
}

function do_action_sort(event) {
    event.stopPropagation();
    var action_id = $(this).attr("id");
    if (!action_id) return;
    switch (action_id) {
        case "btn-sort-update":
            sort_list("date_update");
            break;
        case "btn-sort-creation":
            sort_list("date_creation");
            break;
        case "btn-sort-identity":
            sort_list("identity_title");
            break;
        case "btn-sort-faction":
            sort_list("faction_code");
            break;
        case "btn-sort-lastpack":
            sort_list("lastpack_global_position");
            break;
        case "btn-sort-name":
            sort_list("name");
            break;
    }
    return false;
}

function sort_list(type) {
    var container = $("#cubes");
    var current_sort = container.data("sort-type");
    var current_order = container.data("sort-order");
    var order = current_order || 1;
    if (current_sort && current_sort == type) {
        order = -order;
    }
    container.data("sort-type", type);
    container.data("sort-order", order);
    var sorted_list_id = Cubes.sort(function (a, b) {
        return order * a[type].localeCompare(b[type]);
    }).map(function (cube) {
        return cube.uuid;
    });
    var cube_elt = $("#cube_" + sorted_list_id.shift());

    container.prepend(cube_elt);
    sorted_list_id.forEach(function (cube_uuid) {
        cube_elt = $("#cube_" + cube_uuid).insertAfter(cube_elt);
    });
}

function update_tag_toggles() {
    // tags is an object where key is tag and value is array of cube uuids
    var tag_dict = Cubes.reduce(function (p, c) {
        c.tags.forEach(function (t) {
            if (!p[t]) p[t] = [];
            p[t].push(c.uuid);
        });
        return p;
    }, {});
    var tags = [];
    for (var tag in tag_dict) {
        tags.push(tag);
    }
    var container = $("#tag_toggles").empty();
    tags.sort().forEach(function (tag) {
        $(
            '<button type="button" class="btn btn-default btn-xs" data-toggle="button">' +
                tag +
                "</button>",
        )
            .data("cube_uuid", tag_dict[tag].join(" "))
            .appendTo(container);
    });
}

function set_tags(uuid, tags) {
    var elt = $("#cube_" + uuid);
    var div = elt.find(".cube-list-tags").empty();
    tags.forEach(function (tag) {
        div.append(
            $(
                '<span class="label label-default tag-' +
                    tag +
                    '">' +
                    tag +
                    "</span>",
            ),
        );
    });

    for (var i = 0; i < Cubes.length; i++) {
        if (Cubes[i].uuid == uuid) {
            Cubes[i].tags = tags;
            break;
        }
    }

    update_tag_toggles();
}

function tag_add(uuids) {
    $("#tag_add_uuids").val(uuids);
    $("#tagAddModal").modal("show");
    setTimeout(function () {
        $("#tag_add_tags").focus();
    }, 500);
}

function tag_add_process(event) {
    event.preventDefault();
    var uuids = $("#tag_add_uuids").val().split(/,/);
    var tags = $("#tag_add_tags").val().split(/\s+/);
    if (!uuids.length || !tags.length) return;
    $.ajax(Routing.generate("tag_add"), {
        type: "POST",
        data: { uuids: uuids, tags: tags },
        dataType: "json",
        success: function (data, textStatus, jqXHR) {
            var response = jqXHR.responseJSON;
            if (!response.success) {
                alert("An error occured while updating the tags.");
                return;
            }
            $.each(response.tags, function (uuid, tags) {
                set_tags(uuid, tags);
            });
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.log(
                "[" +
                    moment().format("YYYY-MM-DD HH:mm:ss") +
                    "] Error on " +
                    this.url,
                textStatus,
                errorThrown,
            );
            alert("An error occured while updating the tags.");
        },
    });
}

function tag_remove(uuids) {
    $("#tag_remove_uuids").val(uuids);
    $("#tagRemoveModal").modal("show");
    setTimeout(function () {
        $("#tag_remove_tags").focus();
    }, 500);
}
function tag_remove_process(event) {
    event.preventDefault();
    var uuids = $("#tag_remove_uuids").val().split(/,/);
    var tags = $("#tag_remove_tags").val().split(/\s+/);
    if (!uuids.length || !tags.length) return;
    $.ajax(Routing.generate("tag_remove"), {
        type: "POST",
        data: { uuids: uuids, tags: tags },
        dataType: "json",
        success: function (data, textStatus, jqXHR) {
            var response = jqXHR.responseJSON;
            if (!response.success) {
                alert("An error occured while updating the tags.");
                return;
            }
            $.each(response.tags, function (uuid, tags) {
                set_tags(uuid, tags);
            });
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.log(
                "[" +
                    moment().format("YYYY-MM-DD HH:mm:ss") +
                    "] Error on " +
                    this.url,
                textStatus,
                errorThrown,
            );
            alert("An error occured while updating the tags.");
        },
    });
}

function tag_clear(uuids) {
    $("#tag_clear_uuids").val(uuids);
    $("#tagClearModal").modal("show");
}

function tag_clear_process(event) {
    event.preventDefault();
    var uuids = $("#tag_clear_uuids").val().split(/,/);
    if (!uuids.length) return;
    $.ajax(Routing.generate("tag_clear"), {
        type: "POST",
        data: { uuids: uuids },
        dataType: "json",
        success: function (data, textStatus, jqXHR) {
            var response = jqXHR.responseJSON;
            if (!response.success) {
                alert("An error occured while updating the tags.");
                return;
            }
            $.each(response.tags, function (uuid, tags) {
                set_tags(uuid, tags);
            });
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.log(
                "[" +
                    moment().format("YYYY-MM-DD HH:mm:ss") +
                    "] Error on " +
                    this.url,
                textStatus,
                errorThrown,
            );
            alert("An error occured while updating the tags.");
        },
    });
}

function confirm_delete(cube) {
    $("#delete-cube-name").text(cube.name);
    $("#delete-cube-uuid").val(cube.uuid);
    $("#deleteModal").modal("show");
}

function confirm_delete_all(uuids) {
    $("#delete-cube-list-uuid").val(uuids.join(","));
    $("#deleteListModal").modal("show");
}

function hide_cube() {
    $("#cube").hide();
    $("#close_cube").remove();
}

function show_cube() {
    var cube_uuid = $(LastClickedCube).data("uuid");
    var cube = _.find(Cubes, function (cube) {
        return cube.uuid === cube_uuid;
    });
    if (!cube) return;

    var container = $("#cube_" + cube.uuid);
    $("#cube").appendTo(container);
    $("#cube").show();

    $("#close_cube").remove();
    $(
        '<button type="button" class="close" id="close_cube"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>',
    ).prependTo(container);

    $(this).closest("tr").siblings().removeClass("active");
    $(this).closest("tr").addClass("active");

    NRDB.data.cards.update({}, { incube: 0 });
    for (var i = 0; i < cube.cards.length; i++) {
        var slot = cube.cards[i];
        NRDB.data.cards.updateById(slot.card_code, {
            incube: parseInt(slot.qty, 10),
        });
    }
    $("#cube-name").text(cube.name);
    $("#btn-view").attr(
        "href",
        Routing.generate("cube_view", {
            cube_uuid: cube.uuid,
            _locale: NRDB.locale,
        }),
    );
    $("#btn-edit").attr(
        "href",
        Routing.generate("cube_edit", {
            cube_uuid: cube.uuid,
            _locale: NRDB.locale,
        }),
    );

    var mwl_code = cube.mwl_code,
        mwl_record = mwl_code && NRDB.data.mwl.findById(mwl_code);
    if (mwl_record) {
        MWL = mwl_record;
        $("#mwl").html("Built for " + mwl_record.name);
    } else {
        MWL = null;
        $("#mwl").empty();
    }

    update_cube();
    // convert date from UTC to local
    $("#date_creation").html(
        "Creation: " + moment(cube.date_creation).format("LLLL"),
    );
    $("#date_update").html(
        "Last update: " + moment(cube.date_update).format("LLLL"),
    );
    $("#btn-publish").prop("disabled", cube.problem || cube.unsaved);
}

function update_cube(options) {
    var restrainOneColumn = false;
    if (options) {
        if (options.restrainOneColumn)
            restrainOneColumn = options.restrainOneColumn;
    }

    find_identity();
    if (!Identity) return;

    if (Identity.side_code === "runner") $("#table-graph-strengths").hide();
    else $("#table-graph-strengths").show();

    var displayDescription = getDisplayDescriptions(DisplaySort);
    if (displayDescription == null) return;

    if (DisplaySort === "faction") {
        for (var i = 0; i < displayDescription[1].length; i++) {
            if (displayDescription[1][i].id === Identity.faction_code) {
                displayDescription[0] = displayDescription[1].splice(i, 1);
                break;
            }
        }
    }
    if (DisplaySort === "number" && displayDescription.length === 0) {
        var rows = [];
        NRDB.data.packs.find().forEach(function (pack) {
            rows.push({ id: makeCycleAndPackPosition(pack), label: pack.name });
        });
        displayDescription.push(rows);
    }
    if (restrainOneColumn && displayDescription.length == 2) {
        displayDescription = [
            displayDescription[0].concat(displayDescription[1]),
        ];
    }

    $("#cube-content").empty();
    var cols_size = 12 / displayDescription.length;
    for (var colnum = 0; colnum < displayDescription.length; colnum++) {
        var rows = displayDescription[colnum];
        // Don't rely on the rows being put into displayDescription in order.
        // Explicitly sort them by their provided ID.
        rows.sort((a, b) => {
            if (a.id < b.id) {
                return -1;
            }
            if (a.id > b.id) {
                return 1;
            }
            return 0;
        });

        var div = $("<div>")
            .addClass("col-sm-" + cols_size)
            .appendTo($("#cube-content"));
        for (var rownum = 0; rownum < rows.length; rownum++) {
            var row = rows[rownum];
            var item = $(`<h5>${row.label} (<span></span>)</h5>`).hide();
            if (row.image) {
                item = $(
                    `<h5><svg class="typeIcon" aria-label="${row.label}"><use xlink:href="${row.image}"></use></svg>${row.label} (<span></span>)</h5>`,
                ).hide();
            } else if (DisplaySort == "faction") {
                $(
                    '<span class="icon icon-' +
                        row.id +
                        " " +
                        row.id +
                        '"></span>',
                ).prependTo(item);
            }
            var content = $('<div class="cube-' + row.id + '"></div>');
            div.append(item).append(content);
        }
    }

    InfluenceLimit = 0;
    var cabinet = {};
    var parts = Identity.title.split(/: /);

    $("#identity").html(
        '<a href="' +
            Routing.generate("cards_zoom", { card_code: Identity.code }) +
            '" data-target="#cardModal" data-remote="false" class="card" data-toggle="modal" data-index="' +
            Identity.code +
            '">' +
            parts[0] +
            " <small>" +
            parts[1] +
            "</small></a>" +
            get_card_legality_icons(Identity),
    );
    $("#img_identity").prop(
        "src",
        NRDB.card_image_url + "/medium/" + Identity.code + ".jpg",
    );
    InfluenceLimit = Identity.influence_limit;
    if (InfluenceLimit == null || InfluenceLimit == 0)
        InfluenceLimit = Number.POSITIVE_INFINITY;

    check_cubesize();

    var orderBy = {};
    switch (DisplaySort) {
        case "type":
            orderBy["type_code"] = 1;
            break;
        case "faction":
            orderBy["faction_code"] = 1;
            break;
        case "number":
            orderBy["code"] = 1;
            break;
        case "title":
            orderBy["title"] = 1;
            break;
    }
    switch (DisplaySortSecondary) {
        case "type":
            orderBy["type_code"] = 1;
            break;
        case "faction":
            orderBy["faction_code"] = 1;
            break;
        case "number":
            orderBy["code"] = 1;
            break;
    }
    orderBy["title"] = 1;

    var latestpack = Identity.pack;
    var influenceSpent = {};

    NRDB.data.cards
        .find(
            {
                incube: { $gt: 0 },
                type_code: { $ne: "identity" },
            },
            { $orderBy: orderBy },
        )
        .forEach(function (card) {
            if (
                latestpack.cycle.position < card.pack.cycle.position ||
                (latestpack.cycle.position == card.pack.cycle.position &&
                    latestpack.position < card.pack.position)
            ) {
                latestpack = card.pack;
            }

            var influence = "";
            if (card.faction_code != Identity.faction_code) {
                var theorical_influence_spent = card.incube * card.faction_cost;
                influenceSpent[card.code] =
                    get_influence_cost_of_card_in_cube(card);
                for (var i = 0; i < theorical_influence_spent; i++) {
                    if (i && i % 5 == 0) influence += " ";
                    influence += i < influenceSpent[card.code] ? "●" : "○";
                }

                influence =
                    ' <span class="influence influence-' +
                    card.faction_code +
                    '">' +
                    influence +
                    "</span>";
            }

            var criteria = null;
            var additional_info =
                get_influence_penalty_icons(card, card.incube) + influence;

            if (DisplaySort === "type") {
                ((criteria = card.type_code),
                    (keywords = card.keywords
                        ? card.keywords.toLowerCase().split(" - ")
                        : []));
                if (criteria == "ice") {
                    var ice_type = [];
                    if (keywords.indexOf("barrier") >= 0)
                        ice_type.push("barrier");
                    if (keywords.indexOf("code gate") >= 0)
                        ice_type.push("code-gate");
                    if (keywords.indexOf("sentry") >= 0)
                        ice_type.push("sentry");
                    switch (ice_type.length) {
                        case 0:
                            criteria = "none";
                            break;
                        case 1:
                            criteria = ice_type.pop();
                            break;
                        default:
                            criteria = "multi";
                            break;
                    }
                }
                if (criteria == "program") {
                    if (keywords.indexOf("icebreaker") >= 0)
                        criteria = "icebreaker";
                }
            } else if (DisplaySort === "faction") {
                criteria = card.faction_code;
            } else if (DisplaySort === "number") {
                criteria = makeCycleAndPackPosition(card.pack);
            } else if (DisplaySort === "title") {
                criteria = "cards";
            }

            if (DisplaySort === "number" || DisplaySortSecondary === "number") {
                var number_of_sets = Math.ceil(card.incube / card.quantity);
                var alert_number_of_sets =
                    number_of_sets > 1
                        ? '<small class="text-warning">' +
                          number_of_sets +
                          " sets needed</small> "
                        : "";
                additional_info =
                    '(<span class="small icon icon-' +
                    card.pack.cycle.code +
                    '"></span> ' +
                    card.position +
                    ") " +
                    alert_number_of_sets +
                    influence;
            }

            var item = $(
                "<div>" +
                    card.incube +
                    'x <a href="' +
                    Routing.generate("cards_zoom", { card_code: card.code }) +
                    '" class="card" data-toggle="modal" data-remote="false" data-target="#cardModal" data-index="' +
                    card.code +
                    '">' +
                    card.title +
                    "</a>" +
                    additional_info +
                    get_card_legality_icons(card) +
                    "</div>",
            );
            item.appendTo($("#cube-content .cube-" + criteria));

            cabinet[criteria] |= 0;
            cabinet[criteria] = cabinet[criteria] + card.incube;
            $("#cube-content .cube-" + criteria)
                .prev()
                .show()
                .find("span:last")
                .html(cabinet[criteria]);
        });
    $("#latestpack").html("Cards up to <i>" + latestpack.name + "</i>");
    if (NRDB.settings && NRDB.settings.getItem("show-onesies")) {
        show_onesies();
    } else {
        $("#onesies").hide();
    }
    if (NRDB.settings && NRDB.settings.getItem("show-cacherefresh")) {
        show_cacherefresh();
    } else {
        $("#cacherefresh").hide();
    }
    check_influence(influenceSpent);
    check_restricted();
    check_startup_constraints();
    check_cube_limit();
    check_agenda_factions();
    check_ampere_agenda_limits();
    if (NRDB.settings && NRDB.settings.getItem("check-rotation")) {
        check_rotation();
    } else {
        $("#rotated").hide();
    }
    if ($("#costChart .highcharts-container").length)
        setTimeout(make_cost_graph, 100);
    if ($("#strengthChart .highcharts-container").length)
        setTimeout(make_strength_graph, 100);
}
